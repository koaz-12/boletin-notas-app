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

    updateHeader: function (state) {
        const headerEl = document.getElementById('dispHeaderGrade');
        if (headerEl) {
            headerEl.textContent = `(${state.grade}º Grado)`;
        }
    },

    renderOverlays: function (subjects) {
        // Fix: If subjects are empty/reset, force clear overlays
        if (!subjects || subjects.length === 0) {
            const container = document.getElementById('grades-grid-container');
            if (container) container.innerHTML = ''; // WIPE PAGE 2
            return;
        }
        ReportRenderer.renderOverlays(subjects);
    }
};
