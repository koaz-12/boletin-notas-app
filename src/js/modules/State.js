/**
 * State.js
 * State Management for the application
 */

import { CoreUtils } from './CoreUtils.js';

export class AppState {
    constructor() {
        this.state = {
            grade: "1",
            subjects: [],
            settings: {
                isOverlayMode: true,
                isEditMode: false,
                fontSize: 11
            },
            observations: { p1: "", p2: "", p3: "", p4: "" },
            attendance: {
                p1: { pres: "", abs: "", perc: "", perc_abs: "" },
                p2: { pres: "", abs: "", perc: "", perc_abs: "" },
                p3: { pres: "", abs: "", perc: "", perc_abs: "" },
                p4: { pres: "", abs: "", perc: "", perc_abs: "" }
            },
            studentStatus: { promoted: "", postponed: "", repeater: "" }, // "X" or checkmark
            finalCondition: "", // Text field
            roster: {}, // { "StudName": { subjects: [], attendance: {}, obs: {} } }
            studentList: [], // ["StudName1", "StudName2"]
            currentStudent: "Estudiante 1", // Default
            schoolData: {
                centro: "",
                codigo: "",
                tanda: "",
                telefono: "",
                regional: "",
                distrito: "",
                provincia: "",
                provincia: "",
                municipio: "",
                section: "" // Moved to Global
            }
        };
        this.listeners = [];
        this.gradeConfig = this.getGradeConfig();

        // Debounced save to avoid performance hits
        this.debouncedSave = CoreUtils.debounce(() => this.saveToLocalStorage(), 1000);
    }

    getGradeConfig() {
        // Base Subjects (Grades 1-3)
        // Order: Esp -> Mat -> Soc -> Nat -> Física -> Integral -> Artística
        const lowerPrimary = [
            "Lengua Española",
            "Matemática",
            "Ciencias Sociales",
            "Ciencias de la Naturaleza",
            "Educación Física",
            "Formación Integral, Humana y Religiosa",
            "Educación Artística"
        ];

        // Upper Primary (Grades 4-6)
        // Order: Esp -> Mat -> Soc -> Nat -> Inglés -> Física -> Integral -> Artística
        const upperPrimary = [
            "Lengua Española",
            "Matemática",
            "Ciencias Sociales",
            "Ciencias de la Naturaleza",
            "Lenguas Extranjeras (Inglés)",
            "Educación Física",
            "Formación Integral, Humana y Religiosa",
            "Educación Artística"
        ];

        return {
            "1": [...lowerPrimary],
            "2": [...lowerPrimary],
            "3": [...lowerPrimary], // Grade 3 has no English, but uses Advanced Layout
            "4": [...upperPrimary],
            "5": [...upperPrimary],
            "6": [...upperPrimary]
        };
    }

    init() {
        // Try loading from LocalStorage first
        if (this.loadFromLocalStorage()) {
            console.log("Data loaded from LocalStorage");
        } else {
            console.log("No saved data found. Using defaults.");
            this.loadSubjectsForGrade(this.state.grade);
            this.saveCurrentStudent();
        }
    }

    getState() {
        return this.state;
    }

    setGrade(grade) {
        if (this.state.grade === grade) return;
        this.state.grade = grade;
        this.loadSubjectsForGrade(grade);
        this.notify();
    }

    loadSubjectsForGrade(grade) {
        const names = this.gradeConfig[grade] || this.gradeConfig["1"];
        this.state.subjects = names.map(name => ({
            name: name,
            final: "",
            recovery: "",
            final_recovery: "", // Recuperación Final
            special_recovery: "", // Recuperación Especial
            competencies: [
                { name: "C1", p1: "", rp1: "", p2: "", rp2: "", p3: "", rp3: "", p4: "", rp4: "", final: "", recovery: "" },
                { name: "C2", p1: "", rp1: "", p2: "", rp2: "", p3: "", rp3: "", p4: "", rp4: "", final: "", recovery: "" },
                { name: "C3", p1: "", rp1: "", p2: "", rp2: "", p3: "", rp3: "", p4: "", rp4: "", final: "", recovery: "" }
            ]
        }));
    }

    updateGrade(subIndex, compIndex, field, value) {
        const sub = this.state.subjects[subIndex];
        if (!sub) return;

        if (compIndex >= 0) {
            sub.competencies[compIndex][field] = value;
        } else {
            sub[field] = value;
        }
        this.saveCurrentStudent();
        this.notify();
    }

    updateObservation(period, value) {
        this.state.observations[period] = value;
        this.saveCurrentStudent();
        this.notify();
    }

    updateAttendance(period, field, value) {
        // Defensive: ensure object exists
        if (!this.state.attendance[period]) {
            this.state.attendance[period] = {};
        }
        this.state.attendance[period][field] = value;
        this.saveCurrentStudent();
        this.notify();
    }

    updateStudentStatus(field, value) {
        if (!this.state.studentStatus) {
            this.state.studentStatus = { promoted: "", postponed: "", repeater: "" };
        }
        this.state.studentStatus[field] = value;
        this.saveCurrentStudent();
        this.notify();
    }

    updateFinalCondition(value) {
        this.state.finalCondition = value;
        this.saveCurrentStudent();
        this.notify();
    }

    updateSettings(newSettings) {
        this.state.settings = { ...this.state.settings, ...newSettings };
        this.notify();
    }

    updateSchoolData(field, value) {
        if (!this.state.schoolData) this.state.schoolData = {};
        this.state.schoolData[field] = value;
        this.debouncedSave(); // Auto-save on school data change
        // No need to notify on every keystroke if bindings are one-way, but let's notify for now
        // Assuming inputs listen to 'check' or we want reactivity
    }

    // Full State Load (Project Import)
    loadState(newState) {
        // Validation basic
        if (!newState || !newState.grade) {
            console.error("Invalid state object");
            return false;
        }
        this.state = newState;

        // Ensure structure integrity (migrations if needed)
        if (!this.state.roster) this.state.roster = {};
        if (!this.state.studentList) this.state.studentList = [];
        if (!this.state.schoolData) this.state.schoolData = {};

        // Migration: Attendance Total and Obs General
        if (this.state.attendance && !this.state.attendance.total) {
            this.state.attendance.total = { pres: "", abs: "", perc: "", perc_abs: "" };
        }
        if (this.state.studentInfo && !this.state.studentInfo.obsGeneral) {
            this.state.studentInfo.obsGeneral = "";
        }

        this.notify();
        this.saveToLocalStorage(); // Persist immediately
        return true;
    }

    updateStudentInfo(field, value) {
        if (!this.state.studentInfo) this.state.studentInfo = {};
        this.state.studentInfo[field] = value;
        this.saveCurrentStudent();
        this.notify();
    }

    // Roster Management
    saveCurrentStudent() {
        const s = this.state;
        if (!s.currentStudent) return;

        s.roster[s.currentStudent] = {
            subjects: JSON.parse(JSON.stringify(s.subjects)), // Deep copy
            attendance: JSON.parse(JSON.stringify(s.attendance)),
            observations: JSON.parse(JSON.stringify(s.observations)),
            studentStatus: JSON.parse(JSON.stringify(s.studentStatus || {})),
            finalCondition: s.finalCondition || "",
            studentInfo: JSON.parse(JSON.stringify(s.studentInfo || {})),
            grade: s.grade
        };

        if (!s.studentList.includes(s.currentStudent)) {
            s.studentList.push(s.currentStudent);
        }
    }

    loadStudent(name, saveCurrent = true) {
        // Save previous
        if (saveCurrent) this.saveCurrentStudent();

        // Load new
        this.state.currentStudent = name;
        const data = this.state.roster[name];

        if (data) {
            if (data.grade) this.state.grade = parseInt(data.grade); // Restore grade if saved
            this.state.subjects = JSON.parse(JSON.stringify(data.subjects));
            this.state.attendance = JSON.parse(JSON.stringify(data.attendance));
            // Migration: Ensure total exists
            if (!this.state.attendance.total) {
                this.state.attendance.total = { pres: "", abs: "", perc: "", perc_abs: "" };
            }

            this.state.observations = JSON.parse(JSON.stringify(data.observations));
            this.state.studentStatus = JSON.parse(JSON.stringify(data.studentStatus || {}));
            this.state.finalCondition = data.finalCondition || "";
            this.state.studentInfo = JSON.parse(JSON.stringify(data.studentInfo || {}));
            // Migration: Ensure obsGeneral
            if (!this.state.studentInfo.obsGeneral) this.state.studentInfo.obsGeneral = "";
        } else {
            // New Student (Reset)
            // But keep structure
            this.loadSubjectsForGrade(this.state.grade);
            this.state.attendance = {
                p1: { pres: "", abs: "", perc: "", perc_abs: "" },
                p2: { pres: "", abs: "", perc: "", perc_abs: "" },
                p3: { pres: "", abs: "", perc: "", perc_abs: "" },
                p4: { pres: "", abs: "", perc: "", perc_abs: "" },
                total: { pres: "", abs: "", perc: "", perc_abs: "" }
            };
            this.state.observations = { p1: "", p2: "", p3: "", p4: "" };
            this.state.studentStatus = { promoted: "", postponed: "", repeater: "" };
            this.state.finalCondition = "";
            this.state.studentInfo = { nombres: "", apellidos: "", id: "", order: "", obsGeneral: "" };

            // Save immediately to roster
            this.saveCurrentStudent();
        }
        this.notify();
    }

    deleteStudent(name) {
        // Remove from Roster & List
        if (this.state.roster[name]) delete this.state.roster[name];
        this.state.studentList = this.state.studentList.filter(s => s !== name);

        // Determine Next Student
        let next = this.state.studentList.length > 0 ? this.state.studentList[0] : "Estudiante 1";

        // Load Next WITHOUT saving the deleted one
        this.loadStudent(next, false);
    }

    setRoster(list, rosterData) {
        this.state.studentList = list;
        this.state.roster = rosterData;
        // Load first student without saving previous (as it might be invalid/deleted context)
        if (list.length > 0) {
            this.loadStudent(list[0], false);
        }
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
        this.debouncedSave();
    }

    // --- PERSISTENCE ---
    saveToLocalStorage() {
        try {
            const data = JSON.stringify({
                version: 1,
                timestamp: Date.now(),
                state: this.state
            });
            localStorage.setItem('minerd_boletin_data', data);
            console.log("[AutoSave] Data saved.");
        } catch (e) {
            console.error("[AutoSave] Error saving data:", e);
        }
    }

    loadFromLocalStorage() {
        try {
            const json = localStorage.getItem('minerd_boletin_data');
            if (!json) return false;

            const data = JSON.parse(json);
            if (data && data.state) {
                this.state = { ...this.state, ...data.state };
                return true;
            }
            return false;
        } catch (e) {
            console.error("[AutoSave] Error loading data:", e);
            return false;
        }
    }

    clearLocalStorage() {
        localStorage.removeItem('minerd_boletin_data');
        location.reload(); // Reload to reset state
    }
}

export const store = new AppState();
