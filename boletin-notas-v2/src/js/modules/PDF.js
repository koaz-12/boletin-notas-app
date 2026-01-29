/**
 * PDF.js
 * PDF Loading, Rendering and Batch Export
 */

import { AppUI } from './AppUI.js';
import { store } from './State.js';
import { Toast } from './Toast.js';

export const PDFManager = {
    pdfDoc: null,

    init: function () {
        // Set worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    },

    // New: Auto-load Template (Embedded Base64)
    loadTemplate: async function (grade) {
        console.log(`Cargando plantilla embebida para Grado ${grade}...`);
        const isLoginVisible = !document.getElementById('login-overlay')?.classList.contains('hidden');

        try {
            // Import Templates Dynamically
            // Assumes src/js/config/Templates.js exists and exports GradeTemplates
            const { GradeTemplates } = await import('../config/Templates.js');
            const dataURI = GradeTemplates[grade];

            if (!dataURI) {
                // Not found silently, or warn? 
                console.warn(`No template found for grade ${grade} in registry.`);
                return;
            }

            // Convert Base64 DataURI to Uint8Array for PDF.js
            const pdfData = this.base64ToUint8Array(dataURI);

            // Process directly
            // reuse logic but avoid double overlay toggle if already active?
            const loadingTask = pdfjsLib.getDocument(pdfData);
            this.pdfDoc = await loadingTask.promise;
            this.renderPages();

            // SUCCESS UI
            store.updateSettings({ isOverlayMode: true });
            AppUI.toggleOverlayClass(true);
            const btn = document.getElementById('btnFloatOverlay');
            if (btn) {
                btn.classList.add('bg-blue-600', 'text-white', 'ring-4', 'ring-blue-300');
                btn.classList.remove('bg-white', 'text-blue-600', 'border-blue-700');
            }
            if (!isLoginVisible) {
                Toast.success(`Plantilla de ${grade}º Grado cargada (Embebida).`);
            }

        } catch (e) {
            console.warn("Fallo carga plantilla embebida:", e);
            if (e.message.includes('Módulo')) {
                Toast.error("Error: Archivo Templates.js no generado. Ejecuta script Python.");
            } else {
                Toast.warning(`No se encontró plantilla embebida para ${grade}º Grado.`);
            }
        }
    },

    // Helper: DataURI to Uint8Array
    base64ToUint8Array: function (dataURI) {
        const base64Marker = ';base64,';
        const base64Index = dataURI.indexOf(base64Marker) + base64Marker.length;
        const base64 = dataURI.substring(base64Index);
        const raw = window.atob(base64);
        const rawLength = raw.length;
        const array = new Uint8Array(new ArrayBuffer(rawLength));

        for (let i = 0; i < rawLength; i++) {
            array[i] = raw.charCodeAt(i);
        }
        return array;
    },

    handleUpload: async function (input) {
        const file = input.files[0];
        if (!file || file.type !== 'application/pdf') {
            Toast.warning('Por favor, sube un archivo PDF válido.');
            return;
        }
        await this.processManualFile(file);
    },

    processManualFile: async function (file) {
        const fileReader = new FileReader();
        fileReader.onload = async (e) => {
            const typedarray = new Uint8Array(e.target.result);
            try {
                const loadingTask = pdfjsLib.getDocument(typedarray);
                this.pdfDoc = await loadingTask.promise;
                this.renderPages();

                // UI Updates
                store.updateSettings({ isOverlayMode: true });
                AppUI.toggleOverlayClass(true);
                const btn = document.getElementById('btnFloatOverlay');
                if (btn) {
                    btn.classList.add('bg-blue-600', 'text-white', 'ring-4', 'ring-blue-300');
                    btn.classList.remove('bg-white', 'text-blue-600', 'border-blue-700');
                }
                Toast.success("PDF personalizado cargado.");
            } catch (error) {
                console.error('Error procesando PDF Manual:', error);
                Toast.error('Error al procesar el PDF.');
            }
        };
        fileReader.readAsArrayBuffer(file);
    },

    renderPages: async function () {
        if (!this.pdfDoc) return;
        if (this.pdfDoc.numPages >= 1) await this.renderPage(1, 'canvas-page-1');
        if (this.pdfDoc.numPages >= 2) {
            document.getElementById('page-2').classList.remove('hidden');
            await this.renderPage(2, 'canvas-page-2');
        }
    },

    renderPage: async function (pageNumber, canvasId) {
        const page = await this.pdfDoc.getPage(pageNumber);
        const canvas = document.getElementById(canvasId);
        const context = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 2.0 });

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
    },

    // Batch PDF Generation
    generateBatchPDF: function () {
        const state = store.getState();
        const students = state.studentList;

        if (students.length === 0) {
            Toast.warning("No hay estudiantes para imprimir.");
            return;
        }

        AppUI.confirm(
            "Imprimir Boletines",
            `Se generará un PDF con los boletines de ${students.length} estudiantes.\nEsto puede tardar unos segundos.\n\nAsegúrese de activar "Gráficos de fondo" en la ventana de impresión.`,
            () => {
                // Save current student to restore later
                const initialStudent = state.currentStudent;

                // Prep UI
                const reportContainer = document.querySelector('#report-container'); // The visible one
                const batchContainer = document.createElement('div');
                batchContainer.id = 'batch-print-container';
                batchContainer.className = 'print-only'; // Ensure CSS only shows this

                // Hide main container
                reportContainer.classList.add('hidden');
                document.body.appendChild(batchContainer);

                try {
                    // Loop students
                    students.forEach(studentName => {
                        store.loadStudent(studentName); // Updates DOM (sync?)

                        // CLONE the pages
                        const p1 = document.getElementById('page-1');
                        const p2 = document.getElementById('page-2');

                        // Clone Deep
                        const c1 = p1.cloneNode(true);
                        const c2 = p2.cloneNode(true);

                        // FIX: Manually copy Canvas content (cloneNode doesn't copy canvas bitmap)
                        const copyCanvas = (srcParent, destParent) => {
                            const srcCan = srcParent.querySelector('canvas');
                            const destCan = destParent.querySelector('canvas');
                            if (srcCan && destCan) {
                                const ctx = destCan.getContext('2d');
                                ctx.drawImage(srcCan, 0, 0);
                            }
                        };
                        copyCanvas(p1, c1);
                        copyCanvas(p2, c2);

                        // Add Page Breaks
                        c1.style.breakAfter = 'always'; // Force break after Page 1
                        c1.style.pageBreakAfter = 'always';

                        c2.style.breakAfter = 'always'; // Force break after Page 2 (Student End)
                        c2.style.pageBreakAfter = 'always';

                        // Force Show Clones (if hidden)
                        c1.classList.remove('hidden');
                        c2.classList.remove('hidden');

                        // Append
                        batchContainer.appendChild(c1);
                        batchContainer.appendChild(c2);
                    });

                    // Trigger Print
                    window.print();

                } catch (e) {
                    console.error(e);
                    Toast.error("Error generando PDF masivo: " + e.message);
                } finally {
                    // Restore
                    batchContainer.remove();
                    reportContainer.classList.remove('hidden');
                    if (initialStudent) store.loadStudent(initialStudent);
                }
            }
        );
    },

    // Zip Individual Export
    generateBatchZip: async function () {
        if (typeof JSZip === 'undefined') {
            Toast.error("Error: Librería JSZip no cargada.");
            return;
        }

        const state = store.getState();
        const students = state.studentList;

        if (students.length === 0) {
            Toast.warning("No hay estudiantes para exportar.");
            return;
        }

        if (students.length === 0) {
            Toast.warning("No hay estudiantes para exportar.");
            return;
        }

        AppUI.confirm(
            "Exportación Masiva (ZIP)",
            `Se generarán ${students.length} archivos PDF comprimidos en un ZIP.\n\nEste proceso puede tardar unos minutos.\nPor favor, NO cierres la pestaña.`,
            async () => {
                Toast.info("Iniciando generación masiva... (Por favor espera)");

                const zip = new JSZip();
                const initialStudent = state.currentStudent;

                try {
                    const container = document.getElementById('report-container');

                    // Ensure visual fidelity
                    // container.style.width = '210mm'; // A4 width forced (Usually controlled by CSS)

                    // Loop sequentially
                    for (let i = 0; i < students.length; i++) {
                        const studentName = students[i];
                        store.loadStudent(studentName);

                        // Wait for render (DOM update)
                        await new Promise(r => setTimeout(r, 200));

                        // Determine Filename based on Settings
                        const currentState = store.getState(); // Refetch to get info
                        const settings = currentState.settings || {};
                        const format = settings.pdfNameFormat || 'default';
                        const info = currentState.studentInfo || {};

                        let finalName = studentName; // Default

                        if (format === 'lastname') {
                            // Apellidos, Nombres
                            if (info.apellidos && info.nombres) {
                                finalName = `${info.apellidos} ${info.nombres}`;
                            }
                        } else if (format === 'order') {
                            // Orden - Nombre
                            if (info.order) {
                                const fullName = `${info.nombres || ''} ${info.apellidos || ''}`.trim() || studentName;
                                finalName = `${info.order} - ${fullName}`;
                            }
                        }

                        // Sanitize
                        finalName = finalName.replace(/[/\\?%*:|"<>]/g, '-').trim();
                        if (!finalName) finalName = "SinNombre";
                        const filename = `${finalName}.pdf`;

                        // Config PDF
                        const opts = {
                            margin: 0,
                            filename: filename,
                            image: { type: 'jpeg', quality: 0.95 },
                            html2canvas: { scale: 1.5, useCORS: true, scrollY: 0 },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                            pagebreak: { mode: 'css', after: '.a4-page' }
                        };

                        const blob = await html2pdf().set(opts).from(container).output('blob');
                        zip.file(filename, blob);

                        // Progress Helper
                        console.log(`PDF Generated: ${studentName}`);
                    }

                    // Generate ZIP
                    Toast.success("Comprimiendo archivos...");
                    const content = await zip.generateAsync({ type: "blob" });
                    saveAs(content, `Boletines_${state.grade}Grado_${new Date().toISOString().slice(0, 10)}.zip`);
                    Toast.success("¡Exportación completada! Descargando ZIP.");

                } catch (e) {
                    console.error(e);
                    Toast.error("Error en exportación masiva: " + e.message);
                } finally {
                    // Restore
                    if (initialStudent) store.loadStudent(initialStudent);
                }
            }, false, "Comenzar Exportación");
    }
};
