/**
 * ObservationsManager.js
 * Handles the Intelligent Phrase Bank, Auto-suggestions, and Text Composition.
 */
import { store } from './State.js';
import { Toast } from './Toast.js';
import { AppUI } from './AppUI.js';

export const ObservationsManager = {
    // Default Phrases (Fallback)
    defaultBank: {
        high: [
            "Muestra un excelente desempeño académico.",
            "Participa activamente en todas las actividades.",
            "Es un estudiante muy dedicado y responsable.",
            "Demuestra gran interés por aprender.",
            "Su conducta es ejemplar."
        ],
        average: [
            "Cumple con las asignaciones requeridas.",
            "Debe participar más en clase.",
            "Muestra avances significativos.",
            "Es respetuoso con sus compañeros.",
            "Debe mejorar la puntualidad en la entrega de tareas."
        ],
        low: [
            "Necesita reforzar los contenidos básicos.",
            "Debe mejorar su caligrafía y ortografía.",
            "Requiere mayor apoyo en el hogar.",
            "Se distrae con facilidad en clase.",
            "Debe asistir con mayor regularidad."
        ],
        conduct: [
            "Conversa frecuentemente en clase.",
            "Debe cuidar sus útiles escolares.",
            "Es colaborativo y solidario."
        ]
    },

    // User's Custom Bank
    userBank: null,

    init: function () {
        this.loadBank();
        this.renderBankPanel();
        this.bindGlobalEvents();

        // Attach to Observation Inputs (Delayed slightly to ensure DOM is ready)
        setTimeout(() => {
            const inputs = document.querySelectorAll('textarea[data-action="updateObservation"]');
            this.attachToInputs(inputs);
        }, 500);
    },

    loadBank: function () {
        try {
            const saved = localStorage.getItem('minerd_comment_bank');
            if (saved) {
                this.userBank = JSON.parse(saved);
            } else {
                // Clone defaults
                this.userBank = JSON.parse(JSON.stringify(this.defaultBank));
                this.saveBank();
            }
        } catch (e) {
            console.error("Error loading bank", e);
            this.userBank = JSON.parse(JSON.stringify(this.defaultBank));
        }
    },

    saveBank: function () {
        localStorage.setItem('minerd_comment_bank', JSON.stringify(this.userBank));
    },

    // --- LOGIC ---

    getSuggestions: function (average) {
        let category = 'average';
        if (average >= 90) category = 'high';
        if (average < 70) category = 'low';

        // Mix category phrases with some conduct phrases
        const base = this.userBank[category] || [];
        const conduct = this.userBank.conduct || [];

        // Return random subset (e.g., 3 specific + 1 conduct)
        // For now, return all for the user to pick
        return {
            recommended: base,
            conduct: conduct,
            categoryName: category === 'high' ? 'Alto Rendimiento' : (category === 'low' ? 'Refuerzo' : 'Promedio')
        };
    },

    // --- UI RENDERING ---

    renderBankPanel: function () {
        // Only if not exists
        if (document.getElementById('obs-bank-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'obs-bank-panel';
        panel.className = "fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 transform translate-x-full transition-transform duration-300 flex flex-col";
        panel.innerHTML = `
            <div class="p-4 bg-indigo-600 text-white flex justify-between items-center shadow-md">
                <h3 class="font-bold flex items-center gap-2">
                    📚 Banco de Frases
                </h3>
                <button id="btn-close-bank" class="text-white hover:text-gray-200 text-xl font-bold">&times;</button>
            </div>
            
            <div class="p-3 bg-gray-50 border-b flex gap-2 overflow-x-auto">
                <button class="tab-bank text-xs font-bold px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 whitespace-nowrap" data-cat="high">🌟 Alto (90-100)</button>
                <button class="tab-bank text-xs font-bold px-3 py-1 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap" data-cat="average">📝 Promedio</button>
                <button class="tab-bank text-xs font-bold px-3 py-1 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap" data-cat="low">⚠️ Refuerzo</button>
                <button class="tab-bank text-xs font-bold px-3 py-1 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap" data-cat="conduct">🤝 Conducta</button>
            </div>

            <div id="bank-list-container" class="flex-1 overflow-y-auto p-4 space-y-2">
                <!-- Phrases go here -->
            </div>

            <div class="p-4 border-t bg-gray-50">
                <div class="flex gap-2">
                    <input type="text" id="new-phrase-input" placeholder="Escribir nueva frase..." class="flex-1 text-sm border p-2 rounded focus:border-indigo-500 outline-none">
                    <button id="btn-add-phrase" class="bg-indigo-600 text-white px-3 rounded font-bold hover:bg-indigo-700">+</button>
                </div>
                <p class="text-[10px] text-gray-400 mt-1">Se guardará en la categoría activa.</p>
            </div>
        `;
        document.body.appendChild(panel);

        // Bind Close
        document.getElementById('btn-close-bank').onclick = () => this.togglePanel(false);

        // Bind Add
        document.getElementById('btn-add-phrase').onclick = () => this.addPhraseFromInput();

        // Bind Tabs
        panel.querySelectorAll('.tab-bank').forEach(btn => {
            btn.onclick = (e) => {
                this.switchTab(e.target.dataset.cat);

                // Update Style
                panel.querySelectorAll('.tab-bank').forEach(b => {
                    b.classList.remove('bg-indigo-100', 'text-indigo-700');
                    b.classList.add('bg-gray-200', 'text-gray-600');
                });
                e.target.classList.remove('bg-gray-200', 'text-gray-600');
                e.target.classList.add('bg-indigo-100', 'text-indigo-700');
            };
        });

        // Initial Load
        this.switchTab('high');
    },

    activeCategory: 'high',
    activeTargetInput: null, // The input (P1, P2...) we are currently editing

    switchTab: function (category) {
        this.activeCategory = category;
        const container = document.getElementById('bank-list-container');
        container.innerHTML = '';

        const phrases = this.userBank[category] || [];

        phrases.forEach((phrase, index) => {
            const div = document.createElement('div');
            div.className = "group flex items-start justify-between bg-white p-2 rounded border border-gray-100 hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all";

            const span = document.createElement('span');
            span.className = "text-sm text-gray-700 select-none flex-1";
            span.innerText = phrase;

            // Usage Click
            span.onclick = () => this.insertPhrase(phrase);

            // Delete Button
            const btnDel = document.createElement('button');
            btnDel.innerHTML = "&times;";
            btnDel.className = "ml-2 text-gray-300 hover:text-red-500 font-bold px-1 opacity-0 group-hover:opacity-100 transition-opacity";
            btnDel.onclick = (e) => {
                e.stopPropagation();
                this.deletePhrase(category, index);
            };

            div.appendChild(span);
            div.appendChild(btnDel);
            container.appendChild(div);
        });
    },

    togglePanel: function (show, targetInput = null) {
        const panel = document.getElementById('obs-bank-panel');
        if (show) {
            panel.classList.remove('translate-x-full');
            this.activeTargetInput = targetInput;
        } else {
            panel.classList.add('translate-x-full');
            this.activeTargetInput = null;
        }
    },

    addPhraseFromInput: function () {
        const input = document.getElementById('new-phrase-input');
        const text = input.value.trim();
        if (!text) return;

        if (!this.userBank[this.activeCategory]) this.userBank[this.activeCategory] = [];

        this.userBank[this.activeCategory].push(text);
        this.saveBank();
        this.switchTab(this.activeCategory); // Refresh
        input.value = "";
        Toast.success("Frase añadida al banco.");
    },

    deletePhrase: function (category, index) {
        if (!confirm("¿Borrar esta frase?")) return;
        this.userBank[category].splice(index, 1);
        this.saveBank();
        this.switchTab(category);
    },

    insertPhrase: function (phrase) {
        if (!this.activeTargetInput) {
            Toast.warning("Selecciona primero una casilla de observación.");
            return;
        }

        // Parse Smart Tags (Placeholder)
        // let finalPhrase = phrase.replace("{Nombre}", store.state.currentStudent...);
        // For now, simpler append

        let current = this.activeTargetInput.value.trim();
        if (current.length > 0 && !current.endsWith('.')) current += ".";

        const separator = current.length > 0 ? " " : "";
        this.activeTargetInput.value = current + separator + phrase;

        // Trigger Input Event to save state
        this.activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));

        Toast.show("Frase insertada", "success");
    },

    // Bind Tools to Inputs (Called by ReportRenderer)
    attachToInputs: function (inputs) {
        inputs.forEach(input => {
            // Check if already has wrapper
            if (input.dataset.obsHooked) return;

            // Create Toolbar
            const toolbar = document.createElement('div');
            toolbar.className = "absolute right-1 top-1 flex gap-1";

            // Magic Wand (Suggest)
            const btnMagic = document.createElement('button');
            btnMagic.innerHTML = "✨";
            btnMagic.className = "w-5 h-5 flex items-center justify-center bg-yellow-100 text-yellow-600 rounded-full hover:bg-yellow-200 text-[10px] shadow-sm";
            btnMagic.title = "Sugerir Frase (Según Promedio)";
            btnMagic.onclick = (e) => {
                e.stopPropagation();
                this.handleMagicSuggest(input);
            };

            // Book (Open Bank)
            const btnBank = document.createElement('button');
            btnBank.innerHTML = "📚";
            btnBank.className = "w-5 h-5 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200 text-[10px] shadow-sm";
            btnBank.title = "Abrir Banco de Frases";
            btnBank.onclick = (e) => {
                e.stopPropagation();
                this.togglePanel(true, input);
            };

            // Maximize (Expand)
            const btnExpand = document.createElement('button');
            btnExpand.innerHTML = "🔍";
            btnExpand.className = "w-5 h-5 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 text-[10px] shadow-sm";
            btnExpand.title = "Editor Ampliado";
            btnExpand.onclick = (e) => {
                e.stopPropagation();
                // TODO: Implement Expanded Mode
                alert("Modo ampliado pendiente.");
            };

            // Wrap input to position tools
            // Actually, ReportRenderer creates specific layout. We might assume input is in a relative container.
            // If not, we need to wrap it.
            // Let's assume the GridRenderer puts them in a Relative cell.

            // For now, we manually inject.
            if (input.parentElement) {
                input.parentElement.classList.add('relative'); // Ensure relative
                input.parentElement.appendChild(toolbar);
                toolbar.appendChild(btnMagic);
                toolbar.appendChild(btnBank);
                // toolbar.appendChild(btnExpand); 
            }

            input.dataset.obsHooked = "true";
        });
    },

    bindGlobalEvents: function () {
        // Settings Button (Phrase Bank)
        const btnSettings = document.getElementById('btn-open-phrase-bank');
        if (btnSettings) {
            btnSettings.onclick = () => {
                this.togglePanel(true);
                // Close settings modal if open
                const settingsModal = document.getElementById('settings-modal');
                if (settingsModal) settingsModal.classList.add('hidden');
            };
        }

        // Close on click outside (if needed)
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('obs-bank-panel');
            if (panel && !panel.classList.contains('translate-x-full')) {
                // Close if clicking outside panel AND not on a trigger button
                // We add a check for .obs-tool-btn to prevent closing when clicking tools
                if (!panel.contains(e.target) && !e.target.closest('#btn-open-phrase-bank') && !e.target.closest('.obs-tool-btn')) {
                    // Logic to stay open? 
                    // Actually, let's keep it open unless explicit close usually.
                    // But if user clicks the GRID, they might want to write.
                    // So let's NOT auto-close strictly yet, user can close with X.
                }
            }
        });
    },

    handleMagicSuggest: function (input) {
        // Logic to calculate average and set 'activeCategory' and open panel
        // For P1, we need P1 average.
        // P2...
        // This requires accessing store to calculate grades.

        this.togglePanel(true, input);

        // Mock Average for now (or implementation later)
        // Toast.info("Sugerencia basada en promedio... (Lógica en proceso)");

        // Auto-switch tab logic logic
        // this.switchTab('high'); 
    }
};
