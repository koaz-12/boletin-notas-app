/**
 * AppUI.js
 * Main UI Coordinator
 * Delegates to:
 * - UI/GridRenderer.js (Interactive Data Entry)
 * - UI/ReportRenderer.js (Visual Report Overlays)
 */
import { store } from './State.js';
import { ExcelImport } from './ExcelImport.js';
import { GridRenderer } from './UI/GridRenderer.js';
import { ReportRenderer } from './UI/ReportRenderer.js';

export const AppUI = {
    init: function () {
        // this.render(); // REMOVED: Initial render is handled by store.notify() in app.js -> Events subscription
        // store.subscribe(() => this.render()); // REDUNDANT: Events.js handles this with "Skip" logic

        // Bind UI Actions
        document.getElementById('save-student-btn')?.addEventListener('click', () => {
            store.saveCurrentStudent();
            alert('Estudiante guardado en memoria.');
        });

        // Other bindings as needed...
        this.initFloatingControls();
    },

    initFloatingControls: function () {
        const list = document.getElementById('floatingControlsList');
        const btn = document.getElementById('btnToggleControls');
        const icon = document.getElementById('iconToggle');

        if (!list || !btn) return;

        // Load State
        const isHidden = localStorage.getItem('controlsHidden') === 'true';
        if (isHidden) {
            list.classList.add('hidden');
            icon.textContent = 'P'; // Panel / Plus? Using 'P' or generic icon. Let's use standard emoji in HTML.
            // Actually, HTML has ⚙️ by default.
            // If hidden, show ⚙️. If shown, show ✖️.
            icon.textContent = '⚙️';
        } else {
            list.classList.remove('hidden');
            icon.textContent = '✖️';
        }

        // Toggle
        btn.addEventListener('click', () => {
            const nowHidden = list.classList.toggle('hidden');
            localStorage.setItem('controlsHidden', nowHidden);
            icon.textContent = nowHidden ? '⚙️' : '✖️';
        });
    },

    updateFloatingControls: function (state) {
        // Sync Edit Mode Button State
        const btnEdit = document.getElementById('btnFloatEdit');
        if (btnEdit) {
            if (state.settings.isEditMode) {
                btnEdit.classList.add('bg-red-50', 'text-red-600', 'border-red-300');
                btnEdit.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
            } else {
                btnEdit.classList.remove('bg-red-50', 'text-red-600', 'border-red-300');
                btnEdit.classList.add('bg-white', 'text-gray-600', 'border-gray-200');
            }
        }
    },

    render: function () {
        const state = store.getState();
        this.updateHeader(state); // Update Title
        this.renderInteractiveGrid(state.subjects);
        this.renderOverlays(state.subjects);

        // Update Floating Controls (e.g. Edit Mode toggles)
        this.updateFloatingControls(state);
    },

    // Delegate Overlay Toggling
    toggleOverlayClass: function (enabled) {
        ReportRenderer.toggleOverlayClass(enabled);
    },

    // --- FORM UPDATE HELPERS (Keep here or move to FormRenderer later) ---

    updateStatusInputs: function (state) {
        const s = state.studentStatus || {};
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || "";
        };
        setVal('checkPromovido', s.promoted);
        setVal('checkAplazado', s.postponed);
        setVal('checkRepitente', s.repeater);

        const condInput = document.getElementById('inputCondicion');
        if (condInput) condInput.value = state.finalCondition || "";
    },

    updateHeader: function (state) {
        // Update Grade Selector
        const gradeSelect = document.getElementById('gradeSelector');
        if (gradeSelect && gradeSelect.value !== state.grade) {
            gradeSelect.value = state.grade;
        }

        // Update Header Title
        const headerDisp = document.getElementById('dispHeaderGrade');
        if (headerDisp) {
            const g = parseInt(state.grade);
            let suffix = "to";
            if (g === 1 || g === 3) suffix = "er";
            if (g === 2) suffix = "do";
            headerDisp.textContent = `(${g}${suffix} Grado)`;

            // Hide/Show Final Condition Input based on grade
            const condInput = document.getElementById('inputCondicion');
            const condContainer = document.getElementById('containerSituacionFinal');

            const shouldHide = (g <= 2);

            if (condInput) {
                if (shouldHide) condInput.classList.add('hidden');
                else condInput.classList.remove('hidden');
            }
            if (condContainer) {
                if (shouldHide) condContainer.classList.add('hidden');
                else condContainer.classList.remove('hidden');
            }
        }
    },

    updateObsAttInputs: function (state) {
        // Update Observations inputs
        ['p1', 'p2', 'p3', 'p4'].forEach(p => {
            const input = document.getElementById(`obs-${p}`);
            if (input) input.value = state.observations[p];
        });

        // Update Attendance inputs
        ['p1', 'p2', 'p3', 'p4'].forEach(p => {
            ['pres', 'abs', 'perc', 'perc_abs'].forEach(field => {
                const input = document.getElementById(`att-${p}-${field}`);
                if (input) input.value = state.attendance[p][field];
            });
        });

        // Update Attendance Total (Annual)
        if (state.attendance.total) { // Check existence due to migration timing
            const tPerc = document.getElementById('att-total-perc');
            if (tPerc) tPerc.value = state.attendance.total.perc || '';

            const tPercAbs = document.getElementById('att-total-perc_abs');
            if (tPercAbs) tPercAbs.value = state.attendance.total.perc_abs || '';
        }
    },

    // Expose renderInteractiveGrid/renderOverlays on AppUI object for compatibility if app.js calls them directly?
    // app.js calls: AppUI.renderInteractiveGrid(state.subjects)
    // app.js calls: AppUI.renderOverlays(state.subjects)
    // So YES, I must re-expose them or update app.js.
    // I will re-expose them here to avoid touching app.js unnecessarily.

    renderInteractiveGrid: function (subjects) {
        GridRenderer.renderInteractiveGrid(subjects);
    },



    renderOverlays: function (subjects) {
        // Fix: If subjects are empty/reset, force clear overlays
        if (!subjects || subjects.length === 0) {
            const container = document.getElementById('grades-grid-container');
            if (container) container.innerHTML = ''; // WIPE PAGE 2
            return;
        }
        ReportRenderer.renderOverlays(subjects);
    },

    // --- MODAL HELPERS ---
    confirm: function (title, message, onOk, isDanger = false) {
        const modal = document.getElementById('confirmModal');
        if (!modal) return alert(message); // Fallback

        const titleEl = document.getElementById('confirmModalTitle');
        const msgEl = document.getElementById('confirmModalMessage');
        const btnOk = document.getElementById('btnConfirmOk');
        const btnCancel = document.getElementById('btnConfirmCancel');
        const iconContainer = modal.querySelector('.text-red-600')?.parentElement; // Red icon wrapper

        titleEl.innerText = title;
        msgEl.innerText = message;

        // Visual Customization
        if (isDanger) {
            btnOk.className = "w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:text-sm";
            if (iconContainer) iconContainer.classList.remove('hidden');
        } else {
            btnOk.className = "w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:text-sm";
            // Hide red icon for standard confirms? Or swap it. For now, leave as is or hide.
            if (iconContainer) iconContainer.classList.add('hidden');
        }

        btnOk.onclick = () => {
            modal.classList.add('hidden');
            if (onOk) onOk();
        };
        btnCancel.onclick = () => {
            modal.classList.add('hidden');
        };

        modal.classList.remove('hidden');
    },

    prompt: function (title, message, onOk, placeholder = "") {
        const modal = document.getElementById('promptModal');
        if (!modal) {
            const val = prompt(message, placeholder);
            if (val && onOk) onOk(val);
            return;
        }

        const titleEl = document.getElementById('promptModalTitle');
        const msgEl = document.getElementById('promptModalMessage');
        const input = document.getElementById('promptInput');
        const btnOk = document.getElementById('btnPromptOk');
        const btnCancel = document.getElementById('btnPromptCancel');

        titleEl.innerText = title;
        msgEl.innerText = message;
        input.value = "";
        input.placeholder = placeholder;

        const submit = () => {
            const val = input.value.trim();
            if (val) {
                modal.classList.add('hidden');
                onOk(val);
            } else {
                input.focus();
            }
        };

        btnOk.onclick = submit;
        btnCancel.onclick = () => modal.classList.add('hidden');

        // Enter key support
        input.onkeyup = (e) => {
            if (e.key === 'Enter') submit();
        };

        modal.classList.remove('hidden');
        setTimeout(() => input.focus(), 100);
    }
};
