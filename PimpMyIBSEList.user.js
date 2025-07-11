// ==UserScript==
// @name         PimpMyIBSEList
// @namespace    https://www.hollants.com
// @version      2025-07-11
// @description  Erweitert die IBSE-Liste um Buttons zur persönlichen Klassifizierung von Listeneinträgen
// @author       Pieter Hollants
// @copyright    2025 Pieter Hollants, License: GPL-3.0
// @website      https://github.com/pief/pimpmyibselist
// @updateURL    https://github.com/pief/pimpmyibselist/raw/refs/heads/main/PimpMyIBSEList.user.js
// @downloadURL  https://github.com/pief/pimpmyibselist/raw/refs/heads/main/PimpMyIBSEList.user.js
// @match        https://www.ibse.de/liste/view_liste.php
// ==/UserScript==

(function() {
    'use strict';

    // Definierte Zustände für Listeneinträge, bestehend aus Label fürs Popup-Menü und zugehöriger CSS-Klasse.
    // Achtung: Es reicht bei Änderungswünschen nicht aus, diese Liste zu modifizieren, es gibt noch andere Stellen wie z.B. CSS-Regeln.
    const states = [
        { label: 'Noch nicht behandelt', cls: 'unchecked' },
        { label: 'Prio 1', cls: 'prio1' },
        { label: 'Prio 2', cls: 'prio2' },
        { label: 'Prio 3', cls: 'prio3' },
        { label: 'Erledigt', cls: 'done' },
        { label: 'Ignorieren', cls: 'ignore' }
    ];

    // Eigene CSS-Regeln dieses Skripts
    const cssRules = `
        /* Zentrale Farbdefinitionen, die mehrfach referenziert werden */
        :root {
            --unchecked-color: #999999;
            --prio1-color: #d90e00;
            --prio2-color: #fca80a;
            --prio3-color: #755400;
            --done-color: #a7e5a7;
            --ignore-color: #ffc0cb;
        }

        /* Styling für die Zellen der neuen Buttonspalte: horizontal und vertikal zentriert und Mindestabstände zu den umgebenden Tabellenlinien */
        table tr td.tdState {
            text-align: center;
            vertical-align: middle;
            padding: 2px 5px;
            width: 2rem;
        }

        /* Abweichendes Styling für die Zelle im Tabellenkopf */
        table tr:first-of-type td.tdState {
            vertical-align: bottom;
            padding-bottom: 4px;
        }

        table tr:first-of-type td.tdState::before {
            content: '✅';
        }

        /* Generelles Styling für jeden Button */
        button.btnState {
            width: 1.6rem;
            height: 1.6rem;
            border: 1px solid;
            border-radius: 4px;
            background-repeat: no-repeat;
            background-contain: no-contain;
        }

        /* Styling für den Button eines noch nicht behandelten Listeneintrags */
        button.btnState.unchecked::before {
            content: '❓';
        }

        /* Gemeinsames Styling für Prio1, Prio2, Prio3 Listeneinträge */
        button.btnState.prio1,
        button.btnState.prio2,
        button.btnState.prio3 {
            font-weight: bold;
        }

        /* Styling für den Button eines Prio1 Listeneintrags */
        button.btnState.prio1::before {
            content: '1';
            color: var(--prio1-color);
        }

        /* Styling für den Button eines Prio2 Listeneintrags */
        button.btnState.prio2::before {
            content: '2';
            color: var(--prio2-color);
        }

        /* Styling für den Button eines Prio3 Listeneintrags */
        button.btnState.prio3::before {
            content: '3';
            color: var(--prio3-color);
        }

        /* Styling für den Button eines erledigten Listeneintrags */
        button.btnState.done::before {
            content: '✅';
        }

        /* Styling für den Button eines ignorierten Listeneintrags */
        button.btnState.ignore::before {
            content: '🚫';
        }

        /* Styling für das Popup-Menü */
        .btnStatePopupMenu {
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            border-radius: 4px;
            padding: 0.5rem 0;
            z-index: 1000;
            width: 180px;
            display: none;
        }

        .btnStatePopupMenuItem {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            cursor: pointer;
        }

        .btnStatePopupMenuItem:hover {
            background-color: #f0f0f0;
        }

        /* Styling der restlichen Zellen in der Zeile eines noch nicht behandelten Listeneintrags */
        table tr:not(:first-child) td {
            color: var(--unchecked-color);
        }

        /* Styling der restlichen Zellen in der Zeile eines Prio1 Listeneintrags */
        table tr:not(:first-child) td.prio1 {
            color: var(--prio1-color);
            font-style: italic;
        }

        /* Styling der restlichen Zellen in der Zeile eines Prio2 Listeneintrags */
        table tr:not(:first-child) td.prio2 {
            color: var(--prio2-color);
            font-style: italic;
        }

        /* Styling der restlichen Zellen in der Zeile eines Prio3 Listeneintrags */
        table tr:not(:first-child) td.prio3 {
            color: var(--prio3-color);
            font-style: italic;
        }

        /* Styling der restlichen Zellen in der Zeile eines erledigten Listeneintrags */
        table tr:not(:first-child) td.done {
            color: var(--done-color);
            text-decoration: line-through;
        }

        /* Styling der restlichen Zellen in der Zeile eines ignorierten Listeneintrags */
        table tr:not(:first-child) td.ignore {
            color: var(--ignore-color);
            text-decoration: line-through;
        }
`

    /**
     * Persistierter Speicher für den Zustand von Listeneinträgen.
     */
    class State extends Map {
        // Der Schlüssel im localStorage, unter dem der Zeilenzustand persistiert werden
        static #localStorageKey = 'ibse_liste_state';

        constructor() {
            // Zunächst die Map leer initialisieren
            super()

            // Den Gesamtstate aus dem localStorage des Browsers restaurieren
            const raw = localStorage.getItem(State.#localStorageKey);
            const parsed = raw ? JSON.parse(raw) : {};

            // Zum Setzen muss Map.set() und nicht State.set() verwendet werden, da State.set() persistiert
            for (const [k, v] of Object.entries(parsed)) {
                Map.prototype.set.call(this, k, v);
            }
        }

        /**
         * Liefert den Zustand eines Listeneintrags.
         *
         * @param {string | HTMLTableRowElement} key Eine Tabellenzeile eines Listeneintrags, aus der ein Schlüssel gebildet wird, oder der Schlüssel direkt als String.
         * @return {object} Ein Objekt, das den Zustand des Listeneintrags beschreibt.
         */
        get(key) {
            // Wenn ein Objekt übergeben wurde, müssen wir den Schlüssel zur Ablage erst generieren
            if (typeof key !== "string") {
                key = this.#getRowKey(key);
            }

            return super.get(key);
        }

        /**
         * Setzt den Zustand eines Listeneintargs.
         *
         * @param {string | HTMLTableRowElement} key Eine Tabellenzeile eines Listeneintrags, aus der ein Schlüssel gebildet wird, oder der Schlüssel direkt als String.
         * @param {object} value Ein Objekt, das den Zustand des Listeneintrags beschreibt.
         */
        set(key, value) {
            // Wenn ein Objekt übergeben wurde, müssen wir den Schlüssel zur Ablage erst generieren
            if (typeof key !== "string") {
                key = this.#getRowKey(key);
            }

            super.set(key, value);

            // Wir persistieren direkt nach jedem Setzen
            localStorage.setItem(State.#localStorageKey, JSON.stringify(Object.fromEntries(this.entries())));

            return this;
        }

        /**
         * Generiert den Schlüssel, unter dem der Zustand eines Listeneintrags gespeichert wird.
         *
         * @param {HTMLCollection} row Eine Tabellenzeile eines Listeneintrags
         * @return {string} Der Schlüssel
         */
        #getRowKey(row) {
            // Aus den Spalten "Datum", "Betreiber" und "Detail" wird ein langer String generiert...
            const columnIDs = ['dates', 'operator', 'detail']
            const str = Array.from(row.cells)
            .filter(cell => columnIDs.some(col => cell.classList.contains(col)))
            .map(td => td.textContent.trim())
            .join('\t');

            // ...und durch eine eigene Hashfunktion gejagt, da Javascript keine eingebaute hat.
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = (hash << 5) - hash + char;
            }
            return (hash >>> 0).toString(36).padStart(7, '0');
        }
    }

    /**
     * Fügt einer Tabelle der Liste vorne eine extra Spalte mit Zustandsbuttons der jeweiligen Listeneinträge hinzu.
     *
     * @param {HTMLTableElement} table Die anzupassende Tabelle.
     * @param {State} state Die zur Persistierung des Zustands eines Listeneintrags zu verwendende Zustandsklasse
     */
    function addStateColumnToTable(table, state) {
        // Für die neue Spalte muss für jede Tabellenzeile...
        const rows = Array.from(table.querySelectorAll('tr'));
        rows.forEach((row, index) => {
            // ...eine neue Zelle erzeugt werden
            const tdState = document.createElement('td');
            tdState.className = 'tdState';

            // Wenn dies nicht der Tabellenkopf ist...
            if (index > 0) {
                // ...erzeugen wir einen neuen Button, der den Zustand des Listeneintrags festlegt.
                // Der initiale Zustand kommt aus der Zustandsklasse "state", sofern vorhanden.
                const rowState = state.get(row);
                const btnState = document.createElement('button');
                btnState.classList.add('btnState');
                btnState.classList.add(rowState ? rowState : 'unchecked');

                // Füge den Button der neuen Tabellenzelle hinzu
                tdState.appendChild(btnState);
            }

            // Füge die neue Zelle vor der ersten bereits vorhandenen Zelle ein
            row.insertBefore(tdState, row.firstElementChild);

            // Wenn dies nicht der Tabellenkopf ist: die restlichen Zellen abhängig vom Button-Zustand anpassen
            if (index > 0) {
                updateRowStyle(row, state);
            }
        });
    }

    /**
     * Aktualisiert einen Listeneintrag in Abhängigkeit des Zustandsbuttons in der ersten Spalte.
     *
     * @param {HTMLTableRowElement} row Der zu aktualisierende Listeneintrag.
     * @param {State} state Die zur Persistierung der Eintragszustände zu verwendende Zustandsklasse
     */
    function updateRowStyle(row, state) {
        // Der zugehörige Zustandsbutton zum Listeneintrag
        const btnState = row.querySelector('button.btnState');

        // In der CSS-Klassenliste sollte immer nur eine der Klassen aus "states" sein
        const selectedState = Array.from(btnState.classList).filter(cls => states.map(item => item.cls).includes(cls))[0];

        // Alle Spalten außer der Buttonspalte bekommen die selbe Klasse gesetzt
        const tds = Array.from(row.children).slice(1);
        tds.forEach(td => {
            // CSS-Klassen für alle anderen Zustände von der aktuellen Zelle entfernen...
            const other_classes = states.map(item => item.cls).filter(cls => selectedState);
            other_classes.forEach(cls => {
                td.classList.remove(cls);
            });

            // ...und die aktuelle des Zustandbuttons hinzufügen
            td.classList.add(selectedState);
        });

        // Sofern der Zustand des Listeneintrags nicht "unbehandelt" ist, wird ein eventuell vorhandener gelber Hintergrund entfernt
        if (selectedState !== 'unchecked') {
            row.classList.remove('mod-row');
        }

        // Der Zustands des Buttons wird außerdem mittels der Zustandsklasse persistiert
        state.set(row, selectedState);
    }

    /**
     * Fügt den Eventhandler hinzu, der bei Klick auf dem Zustandsbutton eines Listeneintrags das zugehörige Popupmenü öffnet.
     *
     * Darf nur einmal definiert werden, deswegen nicht Teil von addStateColumnToTable().
     *
     * @param {State} state Die zur Persistierung der Eintragszustände zu verwendende Zustandsklasse
     */
    function addBtnStatePopupMenu(state) {
        // Eventhandler für Mausklicks hinzufügen
        document.addEventListener('click', (e) => {
            // Klick auf einen Button?
            if (e.target.matches('.btnState')) {
                let btnState = e.target;

                // Evtl. angezeigtes Popupmenü für anderen Button schließen
                closePopupMenu();

                // DIV-Element für Popup-Menü erzeugen und an Dokumentstruktur anhängen
                const menu = document.createElement('div');
                menu.className = 'btnStatePopupMenu';
                document.body.appendChild(menu);

                // DIV-Nodes für Menüeinträge ergänzen und mit entsprechenden Zustand-setzen-Funktionen verknüpfen
                states.forEach(item => {
                    const menuEntry = document.createElement('div');
                    menuEntry.className = 'btnStatePopupMenuItem';
                    menuEntry.innerHTML = `<button class="btnState ${item.cls}"></button> ${item.label}`;
                    menuEntry.onclick = (e) => {
                        // Popupmenü schon mal schließen
                        closePopupMenu();

                        // Globalen Event handler ausschalten
                        e.stopPropagation();

                        // CSS-Klassen für alle anderen Zustände vom Button entfernen...
                        const other_classes = states.map(item => item.cls).filter(cls => cls != item.cls);
                        other_classes.forEach(cls => {
                            btnState.classList.remove(cls);
                        });

                        // ...und die für den ausgewählten Zustand hinzufügen
                        btnState.classList.add(item.cls);

                        // Restliche Zellen abhängig vom Buttonzustand anpassen
                        updateRowStyle(btnState.parentNode.parentNode, state);
                    };
                    menu.appendChild(menuEntry);
                });

                // Menü relativ zum Button positionieren
                const rect = btnState.getBoundingClientRect();
                menu.style.top = `${rect.bottom + window.scrollY}px`;
                menu.style.left = `${rect.left + window.scrollX}px`;
                menu.style.display = 'block';
            } else {
                // Ein Klick woanders hin schließt das Popupmenü
                closePopupMenu();
            }
        });
    }

    /**
     * Schließt ein evtl. geöffnete Popup-Menü für einen Zustandbutton.
     */
    function closePopupMenu() {
        document.querySelectorAll('.btnStatePopupMenu').forEach(node => node.remove());
    }

    /**
     * Korrigiert vorhandene CSS-Regeln in der Liste bezüglich der neuen Spalte und fügt eigenen CSS-Code hinzu
     */
    function fixAndAddCss() {
        // Vorhandene CSS-Regel für die Tabellenüberschrift bzgl. neuer Spalte vorne anpassen
        const cssHeadlineRuleOld = '.table-fahrt tr:first-of-type td:first-of-type';
        const cssHeadlineRuleNew = '.table-fahrt tr:first-of-type td:nth-of-type(2)';

        for (const styleSheet of document.styleSheets) {
            const rules = styleSheet.cssRules || styleSheet.rules;
            for (let i = 0; i < rules.length; i++) {
                const r = rules[i];
                if (r.selectorText === cssHeadlineRuleOld) {
                    r.selectorText = cssHeadlineRuleNew;
                }
            }
        }

        // Einen neuen <style>-Knoten für unsere eigenen CSS-Regeln anlegen
        const style = document.createElement('style');
        style.textContent = cssRules.trim();
        document.head.appendChild(style);
    }

    // Hauptcode, ausgeführt, sobald das Fenster vollständig geladen wurde
    window.addEventListener('load', () => {
        // Initialisiere die Zustandsklasse
        const state = new State();

        // Füge allen Tabellen die Extraspalte zur Zustandsauswahl hinzu
        document.querySelectorAll('table').forEach(node => addStateColumnToTable(node, state));

        addBtnStatePopupMenu(state);

        // CSS der Seite korrigieren und ergänzen
        fixAndAddCss();
    });
})();
