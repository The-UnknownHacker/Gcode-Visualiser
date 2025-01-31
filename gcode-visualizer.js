class GCodeVisualizer {
    constructor() {
        this.visualizer = document.getElementById('visualizer');
        this.gcodeEditor = document.getElementById('gcodeEditor');
        this.fileInput = document.getElementById('gcodeFile');
        this.exportBtn = document.getElementById('exportBtn');
        
        this.commands = [];
        this.selectedNode = null;
        
        this.isStacked = false;
        
        this.debouncedUpdate = this.debounce(() => this.updateVisualization(), 150);
        
        this.virtualScroll = {
            itemHeight: 120,
            nodeWidth: 200,
            nodeMargin: 20,
            verticalGap: 60,
            visibleItems: 0,
            startIndex: 0,
            endIndex: 0,
            scrollTop: 0
        };
        
        if (this.visualizer) {
            this.visualizer.addEventListener('scroll', () => this.handleScroll());
        }
        
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.progressText = document.getElementById('progressText');
        this.isProcessing = false;
        
        this.stackedGroups = new Map();
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.loadFile(e));
        }
        
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportGCode());
        }
        
        if (this.gcodeEditor) {
            this.gcodeEditor.addEventListener('input', () => this.debouncedUpdate());
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async loadFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            if (this.gcodeEditor) {
                this.gcodeEditor.value = text;
                this.updateVisualization();
            }
        } catch (error) {
            console.error('Error loading file:', error);
        }
    }

    parseGCode(gcode) {
        if (!gcode) return;

        const lines = gcode.split('\n');
        this.commands = [];
        let batchSize = 2000;
        let currentIndex = 0;
        
        this.isProcessing = true;
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'block';
        }
        if (this.progressText) {
            this.progressText.textContent = '0%';
        }

        const processBatch = () => {
            const endIndex = Math.min(currentIndex + batchSize, lines.length);
            
            for (let i = currentIndex; i < endIndex; i++) {
                const line = lines[i].trim();
                if (!line || line.startsWith(';')) continue;
                
                const command = this.parseCommand(line);
                if (command) this.commands.push(command);
            }

            if (this.progressText) {
                const progress = Math.round((currentIndex / lines.length) * 100);
                this.progressText.textContent = `${progress}%`;
            }

            currentIndex = endIndex;
            
            if (currentIndex < lines.length) {
                setTimeout(processBatch, 0);
            } else {
                this.isProcessing = false;
                if (this.loadingIndicator) {
                    this.loadingIndicator.style.display = 'none';
                }
                
                if (this.isStacked) {
                    this.commands = this.stackSequentialMovements(this.commands);
                }
                
                this.updateContainerHeight();
                this.renderVisibleNodes();
            }
        };

        processBatch();
    }

    parseCommand(line) {
        line = line.toUpperCase();
        
        if (line.includes('M104') || line.includes('M109')) {
            const temp = line.match(/S(\d+)/);
            return {
                type: 'temperature',
                description: `Set Hotend to ${temp ? temp[1] : '0'}°C`,
                color: '#ff4444',
                original: line
            };
        }


        if (line.includes('M140') || line.includes('M190')) {
            const temp = line.match(/S(\d+)/);
            return {
                type: 'bed_temp',
                description: `Set Bed to ${temp ? temp[1] : '0'}°C`,
                color: '#ff8800',
                original: line
            };
        }

        if (line.startsWith('G0') || line.startsWith('G1')) {
            const x = line.match(/X([-\d.]+)/);
            const y = line.match(/Y([-\d.]+)/);
            const z = line.match(/Z([-\d.]+)/);
            const e = line.match(/E([-\d.]+)/);
            
            let desc = 'Move to';
            if (x) desc += ` X:${x[1]}`;
            if (y) desc += ` Y:${y[1]}`;
            if (z) desc += ` Z:${z[1]}`;
            if (e) desc += ` E:${e[1]}`;

            return {
                type: 'movement',
                description: desc,
                color: '#4444ff',
                original: line
            };
        }

        if (line.startsWith('M106') || line.startsWith('M107')) {
            const speed = line.match(/S(\d+)/);
            return {
                type: 'fan',
                description: line.startsWith('M107') ? 'Fan Off' : 
                    `Fan Speed: ${speed ? speed[1] : '255'}`,
                color: '#44ff44',
                original: line
            };
        }

        if (line.startsWith('G28')) {
            return {
                type: 'home',
                description: 'Home Axes',
                color: '#aa44ff',
                original: line
            };
        }

        return {
            type: 'other',
            description: line,
            color: '#888888',
            original: line
        };
    }

    stackSequentialMovements(commands) {
        const stacked = [];
        let currentGroup = null;

        commands.forEach(cmd => {
            if (cmd.type === 'movement') {
                if (!currentGroup || !this.isSequentialMovement(currentGroup.lastCommand, cmd)) {
                    if (currentGroup) {
                        stacked.push({
                            type: 'movement_group',
                            commands: currentGroup.commands,
                            color: currentGroup.commands[0].color,
                            count: currentGroup.commands.length,
                            description: `Group of ${currentGroup.commands.length} movements`,
                            firstCommand: currentGroup.commands[0],
                            lastCommand: currentGroup.commands[currentGroup.commands.length - 1]
                        });
                    }
                    currentGroup = {
                        commands: [cmd],
                        lastCommand: cmd
                    };
                } else {
                    currentGroup.commands.push(cmd);
                    currentGroup.lastCommand = cmd;
                }
            } else {
                if (currentGroup) {
                    stacked.push({
                        type: 'movement_group',
                        commands: currentGroup.commands,
                        color: currentGroup.commands[0].color,
                        count: currentGroup.commands.length,
                        description: `Group of ${currentGroup.commands.length} movements`,
                        firstCommand: currentGroup.commands[0],
                        lastCommand: currentGroup.commands[currentGroup.commands.length - 1]
                    });
                    currentGroup = null;
                }
                stacked.push(cmd);
            }
        });

        if (currentGroup) {
            stacked.push({
                type: 'movement_group',
                commands: currentGroup.commands,
                color: currentGroup.commands[0].color,
                count: currentGroup.commands.length,
                description: `Group of ${currentGroup.commands.length} movements`,
                firstCommand: currentGroup.commands[0],
                lastCommand: currentGroup.commands[currentGroup.commands.length - 1]
            });
        }

        return stacked;
    }

    isSequentialMovement(prev, current) {
        if (!prev || prev.type !== 'movement' || current.type !== 'movement') {
            return false;
        }

        const getCoords = (desc) => {
            const coords = {};
            ['X', 'Y', 'Z'].forEach(axis => {
                const match = desc.match(new RegExp(`${axis}:([-\\d.]+)`));
                if (match) coords[axis] = parseFloat(match[1]);
            });
            return coords;
        };

        const prevCoords = getCoords(prev.description);
        const currentCoords = getCoords(current.description);

        const prevAxes = Object.keys(prevCoords).sort().join('');
        const currentAxes = Object.keys(currentCoords).sort().join('');

        return prevAxes === currentAxes;
    }

    updateVisualization() {
        if (!this.visualizer) return;
        
        this.visualizer.firstElementChild?.remove();
        const container = document.createElement('div');
        container.style.position = 'relative';
        this.visualizer.appendChild(container);
        this.parseGCode(this.gcodeEditor?.value || '');
    }

    calculateVisibleRange() {
        const viewportHeight = this.visualizer.clientHeight;
        const nodesPerRow = this.getNodesPerRow();
        const scrollTop = this.visualizer.scrollTop;
        const rowHeight = this.virtualScroll.itemHeight + this.virtualScroll.verticalGap;
        const startRow = Math.floor(scrollTop / rowHeight) - 2;
        const visibleRows = Math.ceil(viewportHeight / rowHeight) + 4;
        
        this.virtualScroll.startIndex = Math.max(0, startRow * nodesPerRow);
        this.virtualScroll.endIndex = Math.min(
            this.commands.length,
            (startRow + visibleRows) * nodesPerRow
        );
    }

    renderVisibleNodes() {
        if (this.isProcessing) return;
        
        this.calculateVisibleRange();
        const container = this.visualizer.firstElementChild;
        if (!container) return;

        if (container.childNodes.length > 1000) {
            container.innerHTML = '';
        }

        const currentNodes = new Set();
        container.childNodes.forEach(node => {
            const index = parseInt(node.dataset.index);
            if (index < this.virtualScroll.startIndex || index >= this.virtualScroll.endIndex) {
                node.remove();
            } else {
                currentNodes.add(index);
            }
        });

        const nodesPerRow = this.getNodesPerRow();
        const fragment = document.createDocumentFragment();

        for (let i = this.virtualScroll.startIndex; i < this.virtualScroll.endIndex; i++) {
            if (currentNodes.has(i) || !this.commands[i]) continue;

            const node = this.createNode(this.commands[i], i, nodesPerRow);
            fragment.appendChild(node);
        }

        container.appendChild(fragment);
    }

    createNode(cmd, index, nodesPerRow) {
        const node = document.createElement('div');
        node.className = 'node';
        
        if (cmd.type === 'movement_group') {
            node.classList.add('movement-group');
            const count = document.createElement('div');
            count.className = 'movement-count';
            count.textContent = `${cmd.count} moves`;
            node.appendChild(count);

            for (let i = 0; i < Math.min(3, cmd.count - 1); i++) {
                const stack = document.createElement('div');
                stack.className = 'stack-layer';
                stack.style.transform = `translate(${i * 2}px, ${i * 2}px)`;
                node.appendChild(stack);
            }
        }

        node.dataset.index = index;
        node.style.backgroundColor = this.adjustColor(cmd.color, 0.05);
        
        const row = Math.floor(index / nodesPerRow);
        const col = index % nodesPerRow;
        
        const xPos = col * (this.virtualScroll.nodeWidth + this.virtualScroll.nodeMargin) + this.virtualScroll.nodeMargin;
        const yPos = row * (this.virtualScroll.itemHeight + this.virtualScroll.verticalGap) + this.virtualScroll.nodeMargin;
        
        node.style.left = `${xPos}px`;
        node.style.top = `${yPos}px`;

        const title = document.createElement('div');
        title.className = 'node-title';
        title.textContent = this.getNodeTitle(cmd);
        
        const description = document.createElement('div');
        description.className = 'node-description';
        description.textContent = this.getNodeDescription(cmd);
        
        node.appendChild(title);
        node.appendChild(description);
        
        node.addEventListener('click', () => this.selectNode(node, index, cmd));
        return node;
    }

    getNodeTitle(cmd) {
        switch (cmd.type) {
            case 'movement':
                return cmd.description.split(':')[0];
            case 'temperature':
                return 'Temperature';
            case 'bed_temp':
                return 'Bed Temperature';
            case 'fan':
                return 'Fan';
            case 'home':
                return 'Home';
            default:
                return cmd.type;
        }
    }

    getNodeDescription(cmd) {
        switch (cmd.type) {
            case 'movement':
                return cmd.description;
            case 'temperature':
                return cmd.description;
            case 'bed_temp':
                return cmd.description;
            case 'fan':
                return cmd.description;
            case 'home':
                return cmd.description;
            default:
                return cmd.description;
        }
    }

    getNodesPerRow() {
        const totalNodeWidth = this.virtualScroll.nodeWidth + this.virtualScroll.nodeMargin;
        return Math.floor((this.visualizer.clientWidth - this.virtualScroll.nodeMargin) / totalNodeWidth);
    }

    selectNode(node, index, cmd) {
        if (this.selectedNode) {
            this.selectedNode.classList.remove('selected');
        }
        node.classList.add('selected');
        this.selectedNode = node;

        const lines = this.gcodeEditor.value.split('\n');
        
        if (cmd.type === 'movement_group') {
            const firstLine = lines.findIndex(line => 
                line.trim() === cmd.originalLines[0]);
            const lastLine = lines.findIndex(line => 
                line.trim() === cmd.originalLines[cmd.originalLines.length - 1]);
            
            if (firstLine !== -1 && lastLine !== -1) {
                const start = lines.slice(0, firstLine).join('\n').length + 
                    (firstLine > 0 ? 1 : 0);
                const end = lines.slice(0, lastLine + 1).join('\n').length;
                
                this.gcodeEditor.focus();
                this.gcodeEditor.setSelectionRange(start, end);
                
                const lineHeight = 20; 
                this.gcodeEditor.scrollTop = firstLine * lineHeight - 
                    this.gcodeEditor.clientHeight / 2;
            }
        } else {
        }
    }

    exportGCode() {
        const blob = new Blob([this.gcodeEditor.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exported.gcode';
        a.click();
        URL.revokeObjectURL(url);
    }

    adjustColor(color, factor) {
        let r = parseInt(color.slice(1,3), 16);
        let g = parseInt(color.slice(3,5), 16);
        let b = parseInt(color.slice(5,7), 16);
        
        r = Math.min(255, Math.floor(r * (1 + factor)));
        g = Math.min(255, Math.floor(g * (1 + factor)));
        b = Math.min(255, Math.floor(b * (1 + factor)));
        
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }

    handleScroll() {
        if (this.scrollTimeout) {
            return;
        }
        
        this.scrollTimeout = setTimeout(() => {
            this.virtualScroll.scrollTop = this.visualizer.scrollTop;
            this.renderVisibleNodes();
            this.scrollTimeout = null;
        }, 16); 
    }

    updateContainerHeight() {
        const container = this.visualizer.firstElementChild;
        if (!container) return;
        
        const nodesPerRow = this.getNodesPerRow();
        const totalRows = Math.ceil(this.commands.length / nodesPerRow);
        const totalHeight = totalRows * (this.virtualScroll.itemHeight + this.virtualScroll.verticalGap) + 
            this.virtualScroll.nodeMargin;
        container.style.height = `${totalHeight}px`;
    }
}

new GCodeVisualizer(); 
