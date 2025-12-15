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

    handleUpload: async function (input) {
        const file = input.files[0];
        if (!file || file.type !== 'application/pdf') {
            alert('Por favor, sube un archivo PDF válido.');
            return;
        }

        const fileReader = new FileReader();
        fileReader.onload = async (e) => {
            const typedarray = new Uint8Array(e.target.result);
            try {
                const loadingTask = pdfjsLib.getDocument(typedarray);
                this.pdfDoc = await loadingTask.promise;
                this.renderPages();

                // Activate Overlay Mode
                store.updateSettings({ isOverlayMode: true });
                AppUI.toggleOverlayClass(true);

                // Update new FAB state
                const btn = document.getElementById('btnFloatOverlay');
                if (btn) {
                    btn.classList.add('bg-blue-600', 'text-white', 'ring-4', 'ring-blue-300');
                    btn.classList.remove('bg-white', 'text-blue-600', 'border-blue-700');
                }

                Toast.success('PDF de fondo cargado correctamente.');
            } catch (error) {
                console.error('Error procesando PDF:', error);
                alert('Error al procesar el PDF: ' + error.message);
                Toast.error('Error detallado: ' + error.message);
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

        if (!confirm(`Se generará un PDF con los boletines de ${students.length} estudiantes.\nEsto puede tardar unos segundos.\n\nAsegúrese de activar "Gráficos de fondo" en la ventana de impresión.`)) {
            return;
        }

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
                // Since loadStudent is sync (updates state + notifies => UI update), 
                // the DOM (#page-1, #page-2) now reflects 'studentName'.

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
            alert("Error generando PDF masivo: " + e.message);
        } finally {
            // Restore
            batchContainer.remove();
            reportContainer.classList.remove('hidden');
            if (initialStudent) store.loadStudent(initialStudent);
        }
    }
};
