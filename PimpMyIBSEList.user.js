// ==UserScript==
// @name         PimpMyIBSEList
// @namespace    https://www.hollants.com
// @version      2025-07-22
// @description  Erweitert die IBSE-Liste um Buttons zur persönlichen Klassifizierung von Listeneinträgen
// @author       Pieter Hollants
// @copyright    2025 Pieter Hollants, License: GPL-3.0
// @website      https://github.com/pief/pimpmyibselist
// @updateURL    https://github.com/pief/pimpmyibselist/raw/refs/heads/main/PimpMyIBSEList.user.js
// @downloadURL  https://github.com/pief/pimpmyibselist/raw/refs/heads/main/PimpMyIBSEList.user.js
// @match        https://ibse.de/
// @match        https://www.ibse.de/
// @match        https://ibse.de/liste/view_liste.php
// @match        https://www.ibse.de/liste/view_liste.php
// ==/UserScript==

(function() {
    'use strict';

     let localStorageKey_UserHash = 'ibse_user_hash';
     let localStorageKey_ListState = 'ibse_liste_state';

    /*
     * Erzeugt einen achtstelligen Hash des übergebenen Strings.
     *
     * Ein Hash ist quasi ein verkürzter Fingerabdruck, aus dem nicht der ursprüngliche String rekonstruiert werden kann.
     * Eigenimplementation, weil JavaScript selbst so etwas nicht mitbringt.
     *
     * @param {string} str Der String, für den der Hash erzeugt werden soll.
     *
     * @return {string} Der Hash des Strings.
     */
    function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
        }
        return (hash >>> 0).toString(36).padStart(8, '0');
    }

    // Definierte Zustände für Listeneinträge, bestehend aus Label fürs Popup-Menü und zugehöriger CSS-Klasse.
    // Achtung: Es reicht bei Änderungswünschen nicht aus, diese Liste zu modifizieren, es gibt noch andere Stellen wie z.B. CSS-Regeln.
    const states = [
        { label: 'Unentschieden/Undecided', cls: 'unchecked' },
        { label: 'Prio 1', cls: 'prio1' },
        { label: 'Prio 2', cls: 'prio2' },
        { label: 'Prio 3', cls: 'prio3' },
        { label: 'Erledigt/Done', cls: 'done' },
        { label: 'Ignorieren/Ignore', cls: 'ignore' }
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
        table tr:not(:first-child) td.prio1,
        table tr:not(:first-child) td.prio1 a {
            color: var(--prio1-color);
            font-style: italic;
        }

        /* Styling der restlichen Zellen in der Zeile eines Prio2 Listeneintrags */
        table tr:not(:first-child) td.prio2,
        table tr:not(:first-child) td.prio2 a {
            color: var(--prio2-color);
            font-style: italic;
        }

        /* Styling der restlichen Zellen in der Zeile eines Prio3 Listeneintrags */
        table tr:not(:first-child) td.prio3,
        table tr:not(:first-child) td.prio3 a {
            color: var(--prio3-color);
            font-style: italic;
        }

        /* Styling der restlichen Zellen in der Zeile eines erledigten Listeneintrags */
        table tr:not(:first-child) td.done,
        table tr:not(:first-child) td.done a {
            color: var(--done-color);
            text-decoration: line-through;
        }

        /* Styling der restlichen Zellen in der Zeile eines ignorierten Listeneintrags */
        table tr:not(:first-child) td.ignore,
        table tr:not(:first-child) td.ignore a {
            color: var(--ignore-color);
            text-decoration: line-through;
        }
    `

    /**
     * Persistierter Speicher für den Zustand von Listeneinträgen.
     *
     * Speichert den Zustand sowohl in localStorage als auch pseudonym auf jsonblob.com sofern eine sync_id vorhanden ist.
     */
    class State extends Map {
        // Ja, jeder Hanswurst, der dieses Skript liest, kann hier Daten manipulieren, das ist halt so.
        static #apiURL = 'https://jsonblob.com/api/jsonBlob/';
        static #indexBucket = '1396957549806411776';

        constructor(syncID, setSyncState) {
            // Zunächst die Map leer initialisieren
            super()

            // Funktion zum Sync Status setzen
            this.setSyncState = setSyncState;

            // Die übergebene Sync ID speichern
            this.syncID = syncID;

            // Den Gesamtstate aus dem localStorage des Browsers restaurieren
            const raw = localStorage.getItem(localStorageKey_ListState);
            let parsed = raw ? JSON.parse(raw) : {};

            // Falls wir eine Sync ID haben, synchronisieren wir über einen JSON Store
            if (syncID) {
                this.setSyncState('Synchronisiere...');

                // Index der Buckets vom Server holen
                const indexURL = State.#apiURL + State.#indexBucket;
                this.#safeFetch(indexURL)
                .then(({data, headers}) => {
                    let index = data;
                    if (index[syncID]) {
                        // Für diese Sync-ID gibt es schon einen Bucket
                        this.bucketID = index[syncID];

                        // Zustand aus Bucket holen
                        this.#safeFetch(State.#apiURL + this.bucketID)
                        .then(({data, headers}) => {
                            parsed = data;

                            let now = new Date();
                            this.setSyncState(`${this.#pad(now.getDate())}.${this.#pad(now.getMonth())}.${now.getFullYear()} ${this.#pad(now.getHours())}:${this.#pad(now.getMinutes())}`);
                        });
                    } else {
                        // Neuen Bucket anlegen
                        this.#safeFetch(State.#apiURL, {
                            method: 'POST',
                            body: JSON.stringify({})
                        })
                        .then(({data, headers}) => {
                            // Index aktualisieren
                            this.bucketID = headers.get('Location').split('/').pop();
                            index[syncID] = this.bucketID;
                            this.#safeFetch(indexURL, {
                                method: 'PUT',
                                body: JSON.stringify(index)
                            });
                        });
                    }
                });
            } else {
                this.setSyncState('Inaktiv - Neu einloggen erforderlich');
            }

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

            // Wir persistieren direkt nach jedem Setzen...
            let stateStr = JSON.stringify(Object.fromEntries(this.entries()));

            // ...sowohl im localStorage...
            localStorage.setItem(localStorageKey_ListState, stateStr);

            if (this.syncID) {
                // ...als auch im Bucket
                this.#safeFetch(State.#apiURL + this.bucketID, {
                    method: 'PUT',
                    body: stateStr
                })
                .then(({data, headers}) => {
                    if (data) {
                        let now = new Date();
                        this.setSyncState(`${this.#pad(now.getDate())}.${this.#pad(now.getMonth())}.${now.getFullYear()} ${this.#pad(now.getHours())}:${this.#pad(now.getMinutes())}`);
                    }
                })
            }

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

            // ...und durch die eigene Hashfunktion gejagt.
            return hashString(str);
        }

        /**
         * Ruft Daten von einer URL ab.
         *
         * @param {string} url Die abzurufende URL.
         */
        #safeFetch(url, options = {}) {
            return fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`${response.status} ${response.statusText}`);
                }
                return response.json().then(data => ({
                    data,
                    headers: response.headers
                }));
            })
            .catch(error => {
                this.setSyncState(`Fehler beim ${options.method || 'GET'} ${url}: ${error.message || error}!`);
            })
        }

        /**
         * Formatiert eine Datumskomponente auf zwei Stellen mit führender Null.
         *
         * @param {mixed} Die Datumskomponente.
         * @return {string} Ein zweistelliger String.
         */
        #pad(obj) {
            return obj.toString().padStart(2, '0');
        }
}

    /**
     * Zeigt den Synchronisationsstatus in der Zeile des letzten Updates an.
     *
     * @param {string} status Der aktuelle Synchronisationsstatus.
     */
    function setSyncState(state) {
        document.querySelectorAll('#F p:first-child').forEach(node => {
            if (!node.textContent.includes('Letzte Synchronisation')) {
                node.textContent += '; Letzte Synchronisation/Last sync: ';
            }
            node.textContent = node.textContent.replace(/Letzte Synchronisation.*$/, `Letzte Synchronisation/Last sync: ${state}`);
        });
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
    function updateRowStyle(row) {
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
                        updateRowStyle(btnState.parentNode.parentNode);

                        // Der Zustands des Buttons wird außerdem mittels der Zustandsklasse persistiert
                        state.set(btnState.parentNode.parentNode, item.cls);
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
        console.log(`=== PimpMyIBSEList User Script Version ${GM.info.script.version} by Pieter Hollants ===`);
        console.log('Updates auf: https://github.com/pief/pimpmyibselist/');

        if (window.location.pathname.includes('/liste/view_liste.php')) {
            // Wir befinden uns auf der eigentlichen Listen-Seite

            // UserHash zur Synchronisation der Eintragszustände bereits bekannt?
            let userHash = localStorage.getItem(localStorageKey_UserHash);

            // Initialisiere die Zustandsklasse
            const state = new State(userHash, setSyncState);

            // Füge allen Tabellen die Extraspalte zur Zustandsauswahl hinzu
            document.querySelectorAll('table').forEach(node => addStateColumnToTable(node, state));

            // Aktiviere den Eventhandler für das Zustandsbutton-Popupmenü
            addBtnStatePopupMenu(state);

            // CSS der Seite korrigieren und ergänzen
            fixAndAddCss();
        } else if (window.location.pathname == '/') {
            // Wir befinden uns auf der Hauptseite

            // Generiere und speichere den aus dem Namen in der Begrüßung gebildeten UserHash für Verwendung auf der Listenseite
            document.querySelectorAll('.login-greeting').forEach(node => {
                let userName = node.textContent.trim().replace('Hallo ', '');
                let userHash = hashString(userName);

                console.log(`Speichere UserHash zur Synchronisation der Eintragszustände: ${userHash}`);

                localStorage.setItem(localStorageKey_UserHash, userHash);

                // Userhash hinter dem Loginnamen anzeigen, damit man auch auf Mobilbrowsern erkennt, dass er erkannt wurde
                node.textContent += `(${userHash})`;
            });
        }
    });
})();
