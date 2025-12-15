/**
 * StudentManager.js
 * Handles CRUD operations for students and navigation
 */
import { store } from './State.js';
import { Toast } from './Toast.js';

export const StudentManager = {
    // Add New Student
    addNewStudent: () => {
        const name = prompt("Nombre del nuevo estudiante:");
        if (!name) return;

        const state = store.getState();
        if (state.studentList.includes(name)) {
            Toast.error("Ya existe un estudiante con ese nombre.");
            return;
        }

        store.loadStudent(name); // State will auto-create
        Toast.success(`Estudiante "${name}" creado.`);
    },

    // Delete Current Student
    deleteCurrentStudent: () => {
        const state = store.getState();
        const current = state.currentStudent;

        if (!current) return;

        if (confirm(`¿Estás seguro de ELIMINAR al estudiante "${current}"?\nSe perderán todas sus notas y observaciones.`)) {
            store.deleteStudent(current);
            Toast.warning(`Estudiante "${current}" eliminado.`);
        }
    },

    // Delete All Students (Hard Reset)
    deleteAllStudents: () => {
        if (!confirm("⚠️ ADVERTENCIA CRÍTICA ⚠️\n\nEstás a punto de ELIMINAR TODOS LOS ESTUDIANTES y sus calificaciones.\nEsta acción NO se puede deshacer.\n\n¿Estás realmente seguro?")) return;

        // Reset Store
        store.setRoster([], {});
        // Create Default
        store.loadStudent("Estudiante 1", false);

        Toast.info("Todos los estudiantes han sido eliminados. Se ha reiniciado el sistema.");
    },

    // Navigate (Next/Prev)
    navigateStudent: (dir) => {
        const state = store.getState();
        const list = state.studentList;
        if (list.length <= 1) return;

        const idx = list.indexOf(state.currentStudent);
        if (idx === -1) return;

        let newIdx = idx + dir;
        if (newIdx < 0) newIdx = 0;
        if (newIdx >= list.length) newIdx = list.length - 1;

        if (newIdx !== idx) {
            store.loadStudent(list[newIdx]);
        }
    },

    // Update Navigation UI (Selector, Buttons)
    updateNavigatorUI: (state) => {
        const nav = document.getElementById('studentNavigator');
        const selector = document.getElementById('studentSelector');
        const badge = document.getElementById('studentCountBadge');
        const btnPrev = document.getElementById('btnPrevStudent');
        const btnNext = document.getElementById('btnNextStudent');

        if (!nav) return;

        if (state.studentList.length > 0) {
            nav.classList.remove('hidden');
            badge.innerText = state.studentList.length;

            // Update Selector Options if changed
            if (selector.options.length !== state.studentList.length) {
                selector.innerHTML = '';
                state.studentList.forEach(name => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.innerText = name;
                    selector.appendChild(opt);
                });
            }

            selector.value = state.currentStudent;

            const idx = state.studentList.indexOf(state.currentStudent);
            btnPrev.disabled = idx <= 0;
            btnNext.disabled = idx >= state.studentList.length - 1;
        } else {
            nav.classList.add('hidden');
        }
    }
};
