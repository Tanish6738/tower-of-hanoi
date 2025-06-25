class TowerOfHanoi {
    constructor() {
        try {
            this.pegs = [[], [], []]; // Three pegs to hold disks
            this.moves = 0;
            this.startTime = null;
            this.timerInterval = null;
            this.gameStarted = false;
            this.isDarkMode = this.getSafeLocalStorage('darkMode') === 'true';
            this.draggedDisk = null;
            this.touchStartPos = { x: 0, y: 0 };
            this.isMobile = this.detectMobile();
            
            this.initializeEventListeners();
            this.initializeDarkMode();
            this.newGame();
        } catch (error) {
            console.warn('Tower of Hanoi initialization error:', error);
            this.fallbackInitialization();
        }
    }

    // Safe localStorage access
    getSafeLocalStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.warn('LocalStorage access error:', error);
            return null;
        }
    }

    setSafeLocalStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn('LocalStorage set error:', error);
        }
    }

    // Fallback initialization if main constructor fails
    fallbackInitialization() {
        this.pegs = [[], [], []];
        this.moves = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.gameStarted = false;
        this.isDarkMode = false;
        this.draggedDisk = null;
        this.touchStartPos = { x: 0, y: 0 };
        this.isMobile = window.innerWidth <= 768;
    }

    // Detect if device is mobile
    detectMobile() {
        try {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   ('ontouchstart' in window) || (window.innerWidth <= 768);
        } catch (error) {
            console.warn('Mobile detection error:', error);
            return window.innerWidth <= 768;
        }
    }

    initializeEventListeners() {
        try {
            const elements = {
                newGameBtn: document.getElementById('newGameBtn'),
                resetBtn: document.getElementById('resetBtn'),
                diskCount: document.getElementById('diskCount'),
                darkModeToggle: document.getElementById('darkModeToggle'),
                playAgainBtn: document.getElementById('playAgainBtn')
            };

            // Check if all elements exist
            Object.entries(elements).forEach(([key, element]) => {
                if (!element) {
                    console.warn(`Element ${key} not found`);
                    return;
                }
            });

            if (elements.newGameBtn) {
                elements.newGameBtn.addEventListener('click', () => this.newGame());
            }
            if (elements.resetBtn) {
                elements.resetBtn.addEventListener('click', () => this.resetGame());
            }
            if (elements.diskCount) {
                elements.diskCount.addEventListener('change', () => this.newGame());
            }
            if (elements.darkModeToggle) {
                elements.darkModeToggle.addEventListener('click', () => this.toggleDarkMode());
            }
            if (elements.playAgainBtn) {
                elements.playAgainBtn.addEventListener('click', () => {
                    this.hideSuccessModal();
                    this.newGame();
                });
            }

            // Add mobile-specific event listeners
            if (this.isMobile) {
                document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
                document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
                document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
            }
        } catch (error) {
            console.warn('Event listener initialization error:', error);
        }
    }

    initializeDarkMode() {
        try {
            if (this.isDarkMode) {
                document.documentElement.classList.add('dark');
                const toggle = document.getElementById('darkModeToggle');
                if (toggle) {
                    toggle.innerHTML = '<span class="text-xl">☀️</span>';
                }
            }
        } catch (error) {
            console.warn('Dark mode initialization error:', error);
        }
    }

    toggleDarkMode() {
        try {
            this.isDarkMode = !this.isDarkMode;
            document.documentElement.classList.toggle('dark');
            this.setSafeLocalStorage('darkMode', this.isDarkMode);
            
            const toggle = document.getElementById('darkModeToggle');
            if (toggle) {
                toggle.innerHTML = this.isDarkMode ? '<span class="text-xl">☀️</span>' : '<span class="text-xl">🌙</span>';
            }
        } catch (error) {
            console.warn('Dark mode toggle error:', error);
        }
    }

    newGame() {
        const diskCount = parseInt(document.getElementById('diskCount').value);
        this.resetGameState();
        this.createDisks(diskCount);
        this.updateMinMoves(diskCount);
        this.updateDisplay();
    }

    resetGame() {
        const diskCount = parseInt(document.getElementById('diskCount').value);
        this.resetGameState();
        this.createDisks(diskCount);
        this.updateDisplay();
    }

    resetGameState() {
        this.pegs = [[], [], []];
        this.moves = 0;
        this.startTime = null;
        this.gameStarted = false;
        this.clearTimer();
        this.hideSuccessModal();
    }

    createDisks(count) {
        const colors = [
            'bg-red-500 border-red-600',
            'bg-orange-500 border-orange-600',
            'bg-yellow-500 border-yellow-600',
            'bg-green-500 border-green-600',
            'bg-blue-500 border-blue-600',
            'bg-indigo-500 border-indigo-600',
            'bg-purple-500 border-purple-600'
        ];

        // Clear existing disks
        document.querySelectorAll('.disk').forEach(disk => disk.remove());

        // Create disks on the first peg
        for (let i = 0; i < count; i++) {
            const disk = {
                id: i,
                size: count - i,
                element: this.createDiskElement(i, count - i, colors[i % colors.length])
            };
            this.pegs[0].push(disk);
        }

        this.renderDisks();
    }

    createDiskElement(id, size, colorClass) {
        const disk = document.createElement('div');
        disk.className = `disk absolute ${colorClass} border-2 rounded-lg cursor-grab shadow-lg mobile-friendly`;
        disk.draggable = !this.isMobile; // Disable native drag on mobile
        disk.dataset.diskId = id;
        disk.dataset.size = size;
        
        // Calculate width based on size (responsive)
        const baseWidth = this.isMobile ? 50 : 60; // Smaller base width on mobile
        const widthIncrement = this.isMobile ? 15 : 20; // Smaller increment on mobile
        const width = baseWidth + (size - 1) * widthIncrement;
        
        disk.style.width = `${width}px`;
        disk.style.height = this.isMobile ? '20px' : '24px';
        disk.style.maxWidth = '90%'; // Ensure it doesn't overflow on mobile
        
        // Add disk size indicator
        const fontSize = this.isMobile ? 'text-xs' : 'text-sm';
        disk.innerHTML = `<div class="flex items-center justify-center h-full text-white font-bold ${fontSize}">${size}</div>`;

        // Add event listeners based on device type
        if (this.isMobile) {
            // Mobile touch events are handled globally
            disk.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        } else {
            // Desktop drag events
            disk.addEventListener('dragstart', (e) => this.handleDragStart(e));
            disk.addEventListener('dragend', (e) => this.handleDragEnd(e));
        }

        return disk;
    }

    renderDisks() {
        const pegElements = document.querySelectorAll('.peg');
        
        this.pegs.forEach((peg, pegIndex) => {
            const pegElement = pegElements[pegIndex];
            
            peg.forEach((disk, diskIndex) => {
                const diskElement = disk.element;
                pegElement.appendChild(diskElement);
                
                // Position disk
                const bottom = 20 + (diskIndex * 26); // Stack disks
                diskElement.style.bottom = `${bottom}px`;
                diskElement.style.left = '50%';
                diskElement.style.transform = 'translateX(-50%)';
            });
        });
    }

    handleDragStart(e) {
        const diskId = parseInt(e.target.dataset.diskId);
        const pegIndex = this.findDiskPeg(diskId);
        
        // Check if this is the top disk
        if (pegIndex !== -1 && this.isTopDisk(diskId, pegIndex)) {
            e.dataTransfer.setData('text/plain', diskId);
            e.target.classList.add('dragging');
            
            if (!this.gameStarted) {
                this.startGame();
            }
        } else {
            e.preventDefault();
            this.showInvalidMoveAnimation(e.target);
        }
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    findDiskPeg(diskId) {
        for (let i = 0; i < this.pegs.length; i++) {
            if (this.pegs[i].some(disk => disk.id === diskId)) {
                return i;
            }
        }
        return -1;
    }

    isTopDisk(diskId, pegIndex) {
        const peg = this.pegs[pegIndex];
        return peg.length > 0 && peg[peg.length - 1].id === diskId;
    }

    startGame() {
        this.gameStarted = true;
        this.startTime = Date.now();
        this.startTimer();
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            document.getElementById('timer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    clearTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        document.getElementById('timer').textContent = '00:00';
    }

    updateMinMoves(diskCount) {
        const minMoves = Math.pow(2, diskCount) - 1;
        document.getElementById('minMoves').textContent = minMoves;
    }

    updateDisplay() {
        document.getElementById('moveCounter').textContent = this.moves;
    }

    showInvalidMoveAnimation(element) {
        element.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }

    checkWinCondition() {
        const lastPeg = this.pegs[2];
        const diskCount = parseInt(document.getElementById('diskCount').value);
        
        if (lastPeg.length === diskCount) {
            // Check if disks are in correct order (largest at bottom)
            for (let i = 0; i < lastPeg.length - 1; i++) {
                if (lastPeg[i].size < lastPeg[i + 1].size) {
                    return false;
                }
            }
            this.handleWin();
            return true;
        }
        return false;
    }

    handleWin() {
        this.clearTimer();
        this.showSuccessModal();
    }

    showSuccessModal() {
        const modal = document.getElementById('successModal');
        const finalTime = document.getElementById('timer').textContent;
        
        document.getElementById('finalMoves').textContent = this.moves;
        document.getElementById('finalTime').textContent = finalTime;
        
        modal.classList.remove('hidden');
    }

    hideSuccessModal() {
        document.getElementById('successModal').classList.add('hidden');
    }

    moveDisk(diskId, targetPegIndex) {
        const sourcePegIndex = this.findDiskPeg(diskId);
        
        if (sourcePegIndex === -1 || sourcePegIndex === targetPegIndex) {
            return false;
        }

        const sourcePeg = this.pegs[sourcePegIndex];
        const targetPeg = this.pegs[targetPegIndex];
        const disk = sourcePeg[sourcePeg.length - 1];

        // Check if move is valid
        if (disk.id !== diskId) {
            return false; // Not the top disk
        }

        if (targetPeg.length > 0 && targetPeg[targetPeg.length - 1].size < disk.size) {
            return false; // Cannot place larger disk on smaller one
        }

        // Move the disk
        sourcePeg.pop();
        targetPeg.push(disk);
        
        return true;
    }

    handleTouchStart(e) {
        try {
            if (!e.target.classList.contains('disk')) return;
            
            e.preventDefault();
            const touch = e.touches[0];
            const diskId = parseInt(e.target.dataset.diskId);
            const pegIndex = this.findDiskPeg(diskId);
            
            // Check if this is the top disk
            if (pegIndex !== -1 && this.isTopDisk(diskId, pegIndex)) {
                this.draggedDisk = e.target;
                this.touchStartPos = { x: touch.clientX, y: touch.clientY };
                e.target.classList.add('dragging');
                
                if (!this.gameStarted) {
                    this.startGame();
                }
            } else {
                this.showInvalidMoveAnimation(e.target);
            }
        } catch (error) {
            console.warn('Touch start error:', error);
        }
    }

    handleTouchMove(e) {
        try {
            if (!this.draggedDisk) return;
            
            e.preventDefault();
            const touch = e.touches[0];
            const deltaX = touch.clientX - this.touchStartPos.x;
            const deltaY = touch.clientY - this.touchStartPos.y;
            
            // Move the disk with the touch
            this.draggedDisk.style.transform = `translateX(-50%) translate(${deltaX}px, ${deltaY}px)`;
            this.draggedDisk.style.zIndex = '1000';
            
            // Highlight potential drop zones
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const peg = elementBelow?.closest('.peg');
            
            // Remove previous highlights
            document.querySelectorAll('.peg').forEach(p => p.classList.remove('drop-target'));
            
            if (peg) {
                peg.classList.add('drop-target');
            }
        } catch (error) {
            console.warn('Touch move error:', error);
        }
    }

    handleTouchEnd(e) {
        try {
            if (!this.draggedDisk) return;
            
            e.preventDefault();
            const touch = e.changedTouches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const peg = elementBelow?.closest('.peg');
            
            // Clean up
            this.draggedDisk.classList.remove('dragging');
            this.draggedDisk.style.transform = 'translateX(-50%)';
            this.draggedDisk.style.zIndex = '';
            
            // Remove all drop target highlights
            document.querySelectorAll('.peg').forEach(p => p.classList.remove('drop-target'));
            
            if (peg) {
                const pegIndex = parseInt(peg.dataset.peg);
                const diskId = parseInt(this.draggedDisk.dataset.diskId);
                
                if (this.moveDisk(diskId, pegIndex)) {
                    this.moves++;
                    this.updateDisplay();
                    this.renderDisks();
                    this.checkWinCondition();
                } else {
                    peg.classList.add('invalid-drop');
                    setTimeout(() => peg.classList.remove('invalid-drop'), 500);
                }
            }
            
            this.draggedDisk = null;
        } catch (error) {
            console.warn('Touch end error:', error);
            // Clean up in case of error
            if (this.draggedDisk) {
                this.draggedDisk.classList.remove('dragging');
                this.draggedDisk.style.transform = 'translateX(-50%)';
                this.draggedDisk.style.zIndex = '';
                this.draggedDisk = null;
            }
        }
    }

    // ...existing code...
}

// Global functions for HTML event handlers
let game;

function allowDrop(event) {
    try {
        event.preventDefault();
        const peg = event.currentTarget;
        peg.classList.add('drop-target');
    } catch (error) {
        console.warn('Allow drop error:', error);
    }
}

function drop(event) {
    try {
        event.preventDefault();
        const peg = event.currentTarget;
        const pegIndex = parseInt(peg.dataset.peg);
        const diskId = parseInt(event.dataTransfer.getData('text/plain'));
        
        peg.classList.remove('drop-target');
        
        if (game && game.moveDisk(diskId, pegIndex)) {
            game.moves++;
            game.updateDisplay();
            game.renderDisks();
            game.checkWinCondition();
        } else {
            peg.classList.add('invalid-drop');
            setTimeout(() => peg.classList.remove('invalid-drop'), 500);
        }
    } catch (error) {
        console.warn('Drop error:', error);
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    try {
        game = new TowerOfHanoi();
    } catch (error) {
        console.error('Game initialization failed:', error);
        // Show a fallback message to the user
        document.body.innerHTML = `
            <div class="min-h-screen bg-gray-100 flex items-center justify-center">
                <div class="text-center p-8">
                    <h1 class="text-2xl font-bold text-red-600 mb-4">Game Failed to Load</h1>
                    <p class="text-gray-600 mb-4">Please refresh the page to try again.</p>
                    <button onclick="window.location.reload()" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Refresh Page
                    </button>
                </div>
            </div>
        `;
    }
});

// Add event listener to remove drop-target class when dragging out
document.addEventListener('dragleave', (e) => {
    try {
        if (e.target.classList.contains('peg')) {
            e.target.classList.remove('drop-target');
        }
    } catch (error) {
        console.warn('Drag leave error:', error);
    }
});
