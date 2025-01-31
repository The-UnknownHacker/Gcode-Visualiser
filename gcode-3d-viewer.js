class GCode3DViewer {
    constructor() {
        this.scene = new THREE.Scene();
        this.container = document.getElementById('viewer3d');
        this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 0.1, 2000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.controls = null;
        this.toolpath = new THREE.Object3D();
        this.debugMode = true;  
        this.buildPlateSize = 220; 
        this.printAreaSize = 200;  
        this.extruding = false;
        this.showTravelMoves = true;
        this.showGrid = true;
        this.showAxes = true;
        
        this.init();
    }

    init() {
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setClearColor(0x1a1a1a); 
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.set(0, -200, 200);
        this.camera.up.set(0, 0, 1);
        
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.target.set(0, 0, 0);
        
        this.addBuildPlate();
        this.addGrid();
        this.addAxes();
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, -100, 200);
        this.scene.add(dirLight);
        
        this.animate();
        
        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(this.container);

        if (this.debugMode) console.log('3D viewer initialized');
    }

    addBuildPlate() {
        const plateGeometry = new THREE.PlaneGeometry(this.buildPlateSize, this.buildPlateSize);
        const plateMaterial = new THREE.MeshPhongMaterial({
            color: 0x333333,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        const buildPlate = new THREE.Mesh(plateGeometry, plateMaterial);
        buildPlate.rotation.x = Math.PI / 2;
        buildPlate.position.x = this.printAreaSize / 2;
        buildPlate.position.y = -this.printAreaSize / 2 - 20; 
        buildPlate.position.z = -0.1; 
        this.scene.add(buildPlate);
    }

    addGrid() {
        const gridHelper = new THREE.GridHelper(this.printAreaSize, 20, 0x444444, 0x333333);
        gridHelper.rotation.x = Math.PI / 2;
        gridHelper.position.x = this.printAreaSize / 2;
        gridHelper.position.y = -this.printAreaSize / 2 - 20; 
        this.scene.add(gridHelper);

        const detailGrid = new THREE.GridHelper(this.printAreaSize, 40, 0x555555, 0x444444);
        detailGrid.rotation.x = Math.PI / 2;
        detailGrid.position.x = this.printAreaSize / 2;
        detailGrid.position.y = -this.printAreaSize / 2 - 20;
        detailGrid.position.z = 0.1;
        this.scene.add(detailGrid);

        const borderGeometry = new THREE.BufferGeometry();
        const borderVertices = new Float32Array([
            0, -20, 0, 
            this.printAreaSize, -20, 0,
            this.printAreaSize, -this.printAreaSize - 20, 0,
            0, -this.printAreaSize - 20, 0,
            0, -20, 0
        ]);
        borderGeometry.setAttribute('position', new THREE.BufferAttribute(borderVertices, 3));
        const borderMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const borderLine = new THREE.Line(borderGeometry, borderMaterial);
        this.scene.add(borderLine);
    }

    addAxes() {
        const axesHelper = new THREE.AxesHelper(100);
        axesHelper.rotation.x = -Math.PI / 2;
        axesHelper.position.set(0, 0, 0);
        this.scene.add(axesHelper);
    }

    visualizeGCode(gcode) {
        if (!gcode) return;

        this.scene.remove(this.toolpath);
        this.toolpath = new THREE.Object3D();
        
        let currentPosition = new THREE.Vector3(0, 0, 0); 
        let isAbsolute = true;
        let lines = gcode.split('\n');
        let moveCount = 0;
        
        const travelMaterial = new THREE.LineBasicMaterial({ 
            color: 0x4444ff,
            transparent: true,
            opacity: 0.3,
            linewidth: 1,
            visible: this.showTravelMoves 
        });
        const printMaterial = new THREE.LineBasicMaterial({ 
            color: 0xff9500,  
            linewidth: 2
        });
        
        this.extruding = false;
        let lastExtrudePosition = null;
        let points = [];
        let currentMaterial = travelMaterial;
        
        lines.forEach((line, index) => {
            line = line.toUpperCase().trim();
            
            if (line.startsWith(';') || line.length === 0) return;
            
            if (line.includes('G90')) isAbsolute = true;
            if (line.includes('G91')) isAbsolute = false;
            
            const hasExtrusion = line.match(/E([-\d.]+)/);
            if (hasExtrusion) {
                const eValue = parseFloat(hasExtrusion[1]);
                const wasExtruding = this.extruding;
                this.extruding = eValue > 0;
                
                if (wasExtruding !== this.extruding && points.length > 0) {
                    this.createLineSegment(points, wasExtruding ? printMaterial : travelMaterial);
                    points = [points[points.length - 1]];
                }
            }
            
            if (line.match(/G[0-1]/)) {
                let newPosition = currentPosition.clone();
                let hasMove = false;
                
                ['X', 'Y', 'Z'].forEach(axis => {
                    const match = line.match(new RegExp(axis + '(-?\\d*\\.?\\d+)'));
                    if (match) {
                        hasMove = true;
                        const value = parseFloat(match[1]);
                        if (isAbsolute) {
                            if (axis === 'Y') {
                                newPosition[axis.toLowerCase()] = -value; 
                            } else {
                                newPosition[axis.toLowerCase()] = value;
                            }
                        } else {
                            if (axis === 'Y') {
                                newPosition[axis.toLowerCase()] -= value;
                            } else {
                                newPosition[axis.toLowerCase()] += value;
                            }
                        }
                    }
                });
                
                if (hasMove) {
                    moveCount++;
                    points.push(newPosition.clone());
                    currentPosition.copy(newPosition);
                }
            }
            
            if (points.length > 1 && (this.extruding !== (currentMaterial === printMaterial))) {
                this.createLineSegment(points, this.extruding ? printMaterial : travelMaterial);
                points = [points[points.length - 1]];
                currentMaterial = this.extruding ? printMaterial : travelMaterial;
            }
        });
        
        if (points.length > 1) {
            this.createLineSegment(points, currentMaterial);
        }

        this.scene.add(this.toolpath);
        this.centerCamera();
    }

    createLineSegment(points, material) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        this.toolpath.add(line);
    }

    centerCamera() {
        if (!this.toolpath.children.length) {
            const distance = this.printAreaSize * 1.2;
            const cameraX = this.printAreaSize / 2 + distance * 0.7;
            const cameraY = (-this.printAreaSize / 2 - 20) - distance * 0.7; 
            const cameraZ = distance * 0.7;
            
            this.camera.position.set(cameraX, cameraY, cameraZ);
            this.camera.lookAt(this.printAreaSize / 2, -this.printAreaSize / 2 - 20, 0);
            this.controls.target.set(this.printAreaSize / 2, -this.printAreaSize / 2 - 20, 0);
        } else {
            const box = new THREE.Box3().setFromObject(this.toolpath);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            const maxDim = Math.max(
                Math.max(size.x, this.printAreaSize),
                Math.max(size.y, this.printAreaSize),
                size.z
            ) * 1.2; 
            
            const fov = this.camera.fov * (Math.PI / 180);
            const distance = Math.abs(maxDim / Math.sin(fov / 2));
            
            const cameraX = this.printAreaSize / 2 + distance * 0.7;
            const cameraY = -this.printAreaSize / 2 - 20 - distance * 0.7;
            const cameraZ = distance * 0.7;
            
            this.camera.position.set(cameraX, cameraY, cameraZ);
            this.camera.lookAt(this.printAreaSize / 2, -this.printAreaSize / 2 - 20, 0);
            this.controls.target.set(this.printAreaSize / 2, -this.printAreaSize / 2 - 20, 0);
        }
        
        this.controls.update();
    }

    onResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        this.scene.children.forEach(child => {
            if (child instanceof THREE.GridHelper) {
                child.visible = this.showGrid;
            }
        });
    }

    toggleAxes() {
        this.showAxes = !this.showAxes;
        this.scene.children.forEach(child => {
            if (child instanceof THREE.AxesHelper) {
                child.visible = this.showAxes;
            }
        });
    }

    toggleTravelMoves() {
        this.showTravelMoves = !this.showTravelMoves;
        if (!this.toolpath) return;
        
        this.toolpath.children.forEach(line => {
            if (line.material.color.getHex() === 0x4444ff) { 
                line.visible = this.showTravelMoves;
            }
        });
    }

    setPrintMoveColor(color) {
        if (!this.toolpath) return;
        
        const hexColor = parseInt(color.replace('#', '0x'));
        this.toolpath.children.forEach(line => {
            if (line.material.color.getHex() !== 0x4444ff) { 
                line.material.color.setHex(hexColor);
            }
        });
    }

    setTravelMoveColor(color) {
        if (!this.toolpath) return;
        
        const hexColor = parseInt(color.replace('#', '0x'));
        this.toolpath.children.forEach(line => {
            if (line.material.color.getHex() === 0x4444ff) { 
                line.material.color.setHex(hexColor);
            }
        });
    }

    resetCamera() {
        this.camera.position.set(0, -200, 200);
        this.camera.up.set(0, 0, 1);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }
} 