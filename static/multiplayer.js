// Multiplayer Tower of Hanoi Game
class MultiplayerTowerOfHanoi {
    constructor() {
        this.socket = io();
        this.roomId = null;
        this.playerId = null;
        this.playerName = null;
        this.playerRole = 'player';  // 'player' or 'spectator'
        this.playerTeam = null;      // 'A', 'B', or null
        this.isRoomCreator = false;
        this.gameStarted = false;
        this.gameFinished = false;
        this.gameMode = 'classic';   // 'classic', 'tournament', 'team', 'spectator'
        this.maxPlayers = 2;
        this.opponentMoves = 0;
        
        // Game state
        this.pegs = [[], [], []];
        this.moves = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.draggedDisk = null;
        this.touchStartPos = { x: 0, y: 0 };
        this.isMobile = this.detectMobile();
        this.diskCount = 4;
        
        // Dark mode
        this.isDarkMode = this.getSafeLocalStorage('darkMode') === 'true';
        
        this.initializeUI();
        this.initializeSocketEvents();
        this.initializeDarkMode();
        
        // Check if joining via room link
        const urlPath = window.location.pathname;
        const roomMatch = urlPath.match(/\/room\/([a-zA-Z0-9]+)/);
        if (roomMatch) {
            const roomIdInput = document.getElementById('roomIdInput');
            if (roomIdInput) {
                roomIdInput.value = roomMatch[1];
            }
        }
    }

    // Utility methods from original game
    detectMobile() {
        try {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   ('ontouchstart' in window) || (window.innerWidth <= 768);
        } catch (error) {
            return window.innerWidth <= 768;
        }
    }

    getSafeLocalStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
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

    initializeDarkMode() {
        if (this.isDarkMode) {
            document.documentElement.classList.add('dark');
            const toggle = document.getElementById('darkModeToggle');
            if (toggle) {
                toggle.innerHTML = '<span class="text-xl">☀️</span>';
            }
        }
    }

    toggleDarkMode() {
        this.isDarkMode = !this.isDarkMode;
        document.documentElement.classList.toggle('dark');
        this.setSafeLocalStorage('darkMode', this.isDarkMode);
        
        const toggle = document.getElementById('darkModeToggle');
        if (toggle) {
            toggle.innerHTML = this.isDarkMode ? '<span class="text-xl">☀️</span>' : '<span class="text-xl">🌙</span>';
        }
    }

    initializeUI() {
        // Room creation/joining - with null checks
        const createRoomBtn = document.getElementById('createRoomBtn');
        const joinRoomBtn = document.getElementById('joinRoomBtn');
        const readyBtn = document.getElementById('readyBtn');
        const startGameBtn = document.getElementById('startGameBtn');
        const copyInviteBtn = document.getElementById('copyInviteBtn');
        const leaveRoomBtn = document.getElementById('leaveRoomBtn');
        const newGameBtn = document.getElementById('newGameBtn');
        const darkModeToggle = document.getElementById('darkModeToggle');
        
        if (createRoomBtn) createRoomBtn.addEventListener('click', () => this.createRoom());
        if (joinRoomBtn) joinRoomBtn.addEventListener('click', () => this.joinRoom());
        if (readyBtn) readyBtn.addEventListener('click', () => this.playerReady());
        if (startGameBtn) startGameBtn.addEventListener('click', () => this.startGame());
        if (copyInviteBtn) copyInviteBtn.addEventListener('click', () => this.copyInviteLink());
        if (leaveRoomBtn) leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        if (newGameBtn) newGameBtn.addEventListener('click', () => this.newGame());
        if (darkModeToggle) darkModeToggle.addEventListener('click', () => this.toggleDarkMode());
        
        // Game control buttons
        const forfeitBtn = document.getElementById('forfeitBtn');
        const resetBtn = document.getElementById('resetBtn');
        const leaveGameBtn = document.getElementById('leaveGameBtn');
        if (forfeitBtn) forfeitBtn.addEventListener('click', () => this.forfeitGame());
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetGame());
        if (leaveGameBtn) leaveGameBtn.addEventListener('click', () => this.leaveRoom());

        // Enter key support
        const playerNameInput = document.getElementById('playerNameInput');
        const roomIdInput = document.getElementById('roomIdInput');
        
        if (playerNameInput) {
            playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const roomIdInputEl = document.getElementById('roomIdInput');
                    const roomId = roomIdInputEl ? roomIdInputEl.value.trim() : '';
                    if (roomId) {
                        this.joinRoom();
                    } else {
                        this.createRoom();
                    }
                }
            });
        }

        if (roomIdInput) {
            roomIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.joinRoom();
                }
            });
        }
    }

    initializeSocketEvents() {
        this.socket.on('room_joined', (data) => {
            this.updateRoomInfo(data);
        });

        this.socket.on('room_update', (data) => {
            this.updateRoomInfo(data);
        });

        this.socket.on('game_started', (data) => {
            this.onGameStarted(data);
        });

        this.socket.on('opponent_move', (data) => {
            this.updateOpponentMoves(data);
        });

        this.socket.on('game_ended', (data) => {
            this.onGameEnded(data);
        });

        this.socket.on('player_left', (data) => {
            this.onPlayerLeft(data);
        });

        this.socket.on('player_reset', (data) => {
            this.onPlayerReset(data);
        });

        this.socket.on('reset_failed', (data) => {
            this.onResetFailed(data);
        });

        this.socket.on('left_room', (data) => {
            this.onLeftRoom(data);
        });

        this.socket.on('team_join_failed', (data) => {
            alert('Failed to join team: ' + data.error);
        });

        this.socket.on('player_switch_failed', (data) => {
            alert('Failed to switch role: ' + data.error);
        });
    }

    async createRoom() {
        const playerNameInput = document.getElementById('playerNameInput');
        const diskCountSelect = document.getElementById('diskCountSelect');
        const gameModeSelect = document.getElementById('gameModeSelect');
        const maxPlayersSelect = document.getElementById('maxPlayersSelect');
        
        if (!playerNameInput) {
            console.error('Player name input not found');
            alert('Error: Unable to find player name input field');
            return;
        }
        
        const playerName = playerNameInput.value.trim();
        const diskCount = diskCountSelect ? parseInt(diskCountSelect.value) : 4;
        const gameMode = gameModeSelect ? gameModeSelect.value : 'classic';
        const maxPlayers = maxPlayersSelect ? parseInt(maxPlayersSelect.value) || 2 : 2;
        
        if (!playerName) {
            alert('Please enter your name');
            return;
        }

        try {
            const response = await fetch('/create-room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    player_name: playerName, 
                    disk_count: diskCount,
                    game_mode: gameMode,
                    max_players: maxPlayers
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data) {
                throw new Error('No data received from server');
            }

            if (data.success) {
                this.roomId = data.room_id;
                this.playerId = data.player_id;
                this.playerName = playerName;
                this.isRoomCreator = true;
                this.diskCount = diskCount;
                this.gameMode = gameMode;
                this.maxPlayers = maxPlayers;
                
                this.joinGameRoom();
                this.hideRoomModal();
                this.showLobby();
            } else {
                alert('Failed to create room: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Create room error:', error);
            alert('Error creating room: ' + error.message);
        }
    }

    async joinRoom() {
        const playerNameInput = document.getElementById('playerNameInput');
        const roomIdInput = document.getElementById('roomIdInput');
        const joinRoleSelect = document.getElementById('joinRoleSelect');
        const teamSelect = document.getElementById('teamSelect');
        
        if (!playerNameInput) {
            console.error('Player name input not found');
            alert('Error: Unable to find player name input field');
            return;
        }
        
        if (!roomIdInput) {
            console.error('Room ID input not found');
            alert('Error: Unable to find room ID input field');
            return;
        }
        
        const playerName = playerNameInput.value.trim();
        const roomId = roomIdInput.value.trim();
        const role = joinRoleSelect ? joinRoleSelect.value : 'player';
        const team = teamSelect ? teamSelect.value : 'A';
        
        if (!playerName) {
            alert('Please enter your name');
            return;
        }
        
        if (!roomId) {
            alert('Please enter a room ID');
            return;
        }

        try {
            const response = await fetch('/join-room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    room_id: roomId, 
                    player_name: playerName,
                    role: role,
                    team: role === 'player' ? team : null
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data) {
                throw new Error('No data received from server');
            }

            if (data.success) {
                this.roomId = data.room_id;
                this.playerId = data.player_id;
                this.playerName = playerName;
                this.isRoomCreator = false;
                this.playerRole = data.role;
                this.playerTeam = data.team;
                
                this.joinGameRoom();
                this.hideRoomModal();
                this.showLobby();
            } else {
                alert('Failed to join room: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Join room error:', error);
            alert('Error joining room: ' + error.message);
        }
    }

    joinGameRoom() {
        this.socket.emit('join_game_room', {
            room_id: this.roomId,
            player_id: this.playerId
        });
    }

    // UI Management Methods
    hideRoomModal() {
        const modal = document.getElementById('roomModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    showLobby() {
        const lobby = document.getElementById('gameLobby');
        if (lobby) {
            lobby.classList.remove('hidden');
        }
        this.updateRoomInfo();
    }

    showGameArea() {
        const gameArea = document.getElementById('gameArea');
        const lobby = document.getElementById('gameLobby');
        
        if (gameArea) {
            gameArea.classList.remove('hidden');
        }
        if (lobby) {
            lobby.classList.add('hidden');
        }
    }

    updateRoomInfo() {
        if (this.roomId) {
            const roomIdElement = document.getElementById('currentRoomId');
            const diskCountElement = document.getElementById('currentDiskCount');
            
            if (roomIdElement) {
                roomIdElement.textContent = this.roomId;
            }
            if (diskCountElement) {
                diskCountElement.textContent = this.diskCount;
            }
        }
    }

    playerReady() {
        this.socket.emit('player_ready', {
            room_id: this.roomId,
            player_id: this.playerId
        });
    }

    startGame() {
        this.socket.emit('start_game', {
            room_id: this.roomId,
            player_id: this.playerId
        });
    }

    updateRoomInfo(roomInfo) {
        if (!roomInfo) {
            // Basic room info update
            if (this.roomId) {
                const roomIdElement = document.getElementById('currentRoomId');
                const diskCountElement = document.getElementById('currentDiskCount');
                
                if (roomIdElement) {
                    roomIdElement.textContent = this.roomId;
                }
                if (diskCountElement) {
                    diskCountElement.textContent = this.diskCount;
                }
            }
            return;
        }

        // Detailed room info update with player data
        const currentRoomIdEl = document.getElementById('currentRoomId');
        const currentDiskCountEl = document.getElementById('currentDiskCount');
        
        if (currentRoomIdEl) {
            currentRoomIdEl.textContent = roomInfo.room_id;
        }
        if (currentDiskCountEl) {
            currentDiskCountEl.textContent = roomInfo.disk_count;
        }
        this.diskCount = roomInfo.disk_count;

        // Update players display
        const container = document.getElementById('playersContainer');
        if (!container) {
            console.error('Players container not found');
            return;
        }
        
        container.innerHTML = '';

        Object.entries(roomInfo.players).forEach(([playerId, playerInfo]) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'p-4 border border-gray-200 dark:border-gray-600 rounded-lg';
            playerDiv.setAttribute('data-player-id', playerId);
            
            const isCurrentPlayer = playerId === this.playerId;
            const statusIcon = playerInfo.ready ? '✅' : '⏳';
            const bgColor = isCurrentPlayer ? 'bg-blue-50 dark:bg-blue-900' : 'bg-gray-50 dark:bg-gray-700';
            
            playerDiv.className += ` ${bgColor}`;
            
            let resetInfo = '';
            if (roomInfo.game_started && playerInfo.resets_used !== undefined) {
                const resetsLeft = roomInfo.max_resets - playerInfo.resets_used;
                resetInfo = `<div class="text-xs text-gray-500 dark:text-gray-400">Resets: ${resetsLeft}/${roomInfo.max_resets}</div>`;
            }
            
            let moveInfo = '';
            if (roomInfo.game_started) {
                const currentMoves = isCurrentPlayer ? this.moves : 0;
                moveInfo = `<div class="text-sm text-gray-600 dark:text-gray-400 player-moves">${currentMoves} moves</div>`;
            }
            
            playerDiv.innerHTML = `
                <div class="font-semibold ${isCurrentPlayer ? 'text-blue-800 dark:text-blue-200' : 'text-gray-800 dark:text-gray-200'}">
                    ${playerInfo.name} ${isCurrentPlayer ? '(You)' : ''}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                    ${statusIcon} ${playerInfo.ready ? 'Ready' : 'Not Ready'}
                </div>
                ${moveInfo}
                ${resetInfo}
            `;
            container.appendChild(playerDiv);
        });

        // Show appropriate buttons
        const readyBtn = document.getElementById('readyBtn');
        const startBtn = document.getElementById('startGameBtn');
        
        if (roomInfo.game_started) {
            readyBtn.classList.add('hidden');
            startBtn.classList.add('hidden');
        } else {
            const currentPlayer = roomInfo.players[this.playerId];
            if (currentPlayer && !currentPlayer.ready) {
                readyBtn.classList.remove('hidden');
            } else {
                readyBtn.classList.add('hidden');
            }

            if (this.isRoomCreator && Object.keys(roomInfo.players).length === 2) {
                const allReady = Object.values(roomInfo.players).every(p => p.ready);
                if (allReady) {
                    startBtn.classList.remove('hidden');
                } else {
                    startBtn.classList.add('hidden');
                }
            } else {
                startBtn.classList.add('hidden');
            }
        }
    }

    onGameStarted(data) {
        this.gameStarted = true;
        this.gameFinished = false;
        this.diskCount = data.disk_count;
        this.initializeGame();
        this.showGameArea();
        
        // Set up player names in game area
        const players = Object.values(data.room_info.players);
        const player1NameEl = document.getElementById('player1Name');
        const player2NameEl = document.getElementById('player2Name');
        
        if (player1NameEl) {
            player1NameEl.textContent = this.playerName;
        }
        if (player2NameEl) {
            const opponentName = players.find(p => p.name !== this.playerName)?.name || 'Opponent';
            player2NameEl.textContent = opponentName;
        }
    }

    initializeGame() {
        this.pegs = [[], [], []];
        this.moves = 0;
        this.startTime = Date.now();
        this.opponentMoves = 0;
        
        this.createDisks(this.diskCount);
        this.startTimer();
        this.updateDisplay();
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

        try {
            // Clear existing disks
            const existingDisks = document.querySelectorAll('.disk');
            if (existingDisks) {
                existingDisks.forEach(disk => disk.remove());
            }

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
        } catch (error) {
            console.error('Error creating disks:', error);
            // Fallback: try to clear any existing disks individually
            try {
                const disks = document.getElementsByClassName('disk');
                while (disks.length > 0) {
                    disks[0].remove();
                }
            } catch (fallbackError) {
                console.error('Fallback disk cleanup failed:', fallbackError);
            }
        }
    }

    createDiskElement(id, size, colorClass) {
        const disk = document.createElement('div');
        disk.className = `disk absolute ${colorClass} border-2 rounded-lg cursor-grab shadow-lg mobile-friendly`;
        disk.draggable = !this.isMobile;
        disk.dataset.diskId = id;
        disk.dataset.size = size;
        
        const baseWidth = this.isMobile ? 50 : 60;
        const widthIncrement = this.isMobile ? 15 : 20;
        const width = baseWidth + (size - 1) * widthIncrement;
        
        disk.style.width = `${width}px`;
        disk.style.height = this.isMobile ? '20px' : '24px';
        disk.style.maxWidth = '90%';
        
        const fontSize = this.isMobile ? 'text-xs' : 'text-sm';
        disk.innerHTML = `<div class="flex items-center justify-center h-full text-white font-bold ${fontSize}">${size}</div>`;

        if (this.isMobile) {
            disk.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
            disk.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
            disk.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        } else {
            disk.addEventListener('dragstart', (e) => this.handleDragStart(e));
            disk.addEventListener('dragend', (e) => this.handleDragEnd(e));
        }

        return disk;
    }

    renderDisks() {
        try {
            const pegElements = document.querySelectorAll('.peg');
            if (!pegElements || pegElements.length < 3) {
                console.error('Could not find required peg elements');
                return;
            }
            
            this.pegs.forEach((peg, pegIndex) => {
                const pegElement = pegElements[pegIndex];
                if (!pegElement) {
                    console.error(`Peg element ${pegIndex} not found`);
                    return;
                }
                
                peg.forEach((disk, diskIndex) => {
                    if (!disk || !disk.element) {
                        console.error(`Invalid disk at peg ${pegIndex}, disk ${diskIndex}`);
                        return;
                    }
                    
                    const diskElement = disk.element;
                    pegElement.appendChild(diskElement);
                    
                    const bottom = 20 + (diskIndex * 26);
                    diskElement.style.bottom = `${bottom}px`;
                    diskElement.style.left = '50%';
                    diskElement.style.transform = 'translateX(-50%)';
                });
            });
        } catch (error) {
            console.error('Error rendering disks:', error);
        }
    }

    // Touch and drag handlers (adapted from original game)
    handleTouchStart(e) {
        try {
            if (!e.target.classList.contains('disk')) return;
            
            e.preventDefault();
            const touch = e.touches[0];
            const diskId = parseInt(e.target.dataset.diskId);
            const pegIndex = this.findDiskPeg(diskId);
            
            if (pegIndex !== -1 && this.isTopDisk(diskId, pegIndex)) {
                this.draggedDisk = e.target;
                this.touchStartPos = { x: touch.clientX, y: touch.clientY };
                e.target.classList.add('dragging');
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
            
            // Move the disk element to follow the touch
            const rect = this.draggedDisk.getBoundingClientRect();
            const offsetX = touch.clientX - this.touchStartPos.x;
            const offsetY = touch.clientY - this.touchStartPos.y;
            
            this.draggedDisk.style.transform = `translateX(calc(-50% + ${offsetX}px)) translateY(${offsetY}px)`;
            this.draggedDisk.style.zIndex = '1000';
        } catch (error) {
            console.warn('Touch move error:', error);
        }
    }

    handleTouchEnd(e) {
        try {
            if (!this.draggedDisk) return;
            
            e.preventDefault();
            const touch = e.changedTouches[0];
            
            // Find which peg the touch ended on
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const peg = elementBelow ? elementBelow.closest('.peg') : null;
            
            if (peg) {
                const pegIndex = parseInt(peg.dataset.peg);
                const diskId = parseInt(this.draggedDisk.dataset.diskId);
                
                if (this.moveDisk(diskId, pegIndex)) {
                    // Move successful
                } else {
                    // Move failed - show invalid animation
                    peg.classList.add('invalid-drop');
                    setTimeout(() => peg.classList.remove('invalid-drop'), 500);
                }
            }
            
            // Clean up
            this.draggedDisk.classList.remove('dragging');
            this.draggedDisk.style.transform = 'translateX(-50%)';
            this.draggedDisk.style.zIndex = '';
            this.draggedDisk = null;
        } catch (error) {
            console.warn('Touch end error:', error);
        }
    }

    // Drag and drop handlers
    handleDragStart(e) {
        try {
            const diskId = parseInt(e.target.dataset.diskId);
            const pegIndex = this.findDiskPeg(diskId);
            
            if (pegIndex !== -1 && this.isTopDisk(diskId, pegIndex)) {
                e.dataTransfer.setData('text/plain', diskId);
                e.target.classList.add('dragging');
                this.draggedDisk = e.target;
            } else {
                e.preventDefault();
                this.showInvalidMoveAnimation(e.target);
            }
        } catch (error) {
            console.warn('Drag start error:', error);
            e.preventDefault();
        }
    }

    handleDragEnd(e) {
        try {
            e.target.classList.remove('dragging');
            this.draggedDisk = null;
        } catch (error) {
            console.warn('Drag end error:', error);
        }
    }

    // Timer methods
    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimer() {
        if (!this.startTime) return;
        const elapsed = Date.now() - this.startTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const displaySeconds = seconds % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
        
        const timerElement = document.getElementById('player1Timer');
        if (timerElement) {
            timerElement.textContent = timeStr;
        }
    }

    // Display update methods
    updateDisplay() {
        this.updateMoveCounter();
        this.updateTimer();
    }

    updateMoveCounter() {
        const moveElement = document.getElementById('player1Moves');
        if (moveElement) {
            moveElement.textContent = this.moves;
        }
        
        // Update our own move display in player list
        this.updatePlayerMoveDisplay(this.playerId, this.moves);
    }

    // Game logic methods
    findDiskPeg(diskId) {
        for (let i = 0; i < this.pegs.length; i++) {
            const diskIndex = this.pegs[i].findIndex(disk => disk.id === diskId);
            if (diskIndex !== -1) {
                return i;
            }
        }
        return -1;
    }

    isTopDisk(diskId, pegIndex) {
        if (pegIndex < 0 || pegIndex >= this.pegs.length) return false;
        const peg = this.pegs[pegIndex];
        if (peg.length === 0) return false;
        return peg[peg.length - 1].id === diskId;
    }

    moveDisk(diskId, targetPegIndex) {
        const sourcePegIndex = this.findDiskPeg(diskId);
        
        if (sourcePegIndex === -1 || !this.isTopDisk(diskId, sourcePegIndex)) {
            return false;
        }

        if (sourcePegIndex === targetPegIndex) {
            return false;
        }

        const sourcePeg = this.pegs[sourcePegIndex];
        const targetPeg = this.pegs[targetPegIndex];
        const disk = sourcePeg[sourcePeg.length - 1];

        // Check if move is valid (can't place larger disk on smaller one)
        if (targetPeg.length > 0 && disk.size > targetPeg[targetPeg.length - 1].size) {
            return false;
        }

        // Make the move
        const movedDisk = sourcePeg.pop();
        targetPeg.push(movedDisk);
        this.moves++;

        // Emit move to server for multiplayer
        if (this.roomId && this.playerId) {
            this.socket.emit('player_move', {
                room_id: this.roomId,
                player_id: this.playerId,
                from_peg: sourcePegIndex,
                to_peg: targetPegIndex,
                moves: this.moves
            });
        }

        this.renderDisks();
        this.updateDisplay();

        // Check for win condition
        if (this.checkWin()) {
            this.onGameWin();
        }

        return true;
    }

    checkWin() {
        // Win condition: all disks on the last peg
        return this.pegs[2].length === this.diskCount;
    }

    onGameWin() {
        this.gameFinished = true;
        this.stopTimer();
        
        if (this.roomId && this.playerId) {
            this.socket.emit('game_finished', {
                room_id: this.roomId,
                player_id: this.playerId,
                moves: this.moves,
                time: Date.now() - this.startTime
            });
        }
    }

    // Socket event handlers
    updateOpponentMoves(data) {
        // Don't update for own moves
        if (data.player_id === this.playerId) {
            return;
        }
        
        // Update opponent move display
        const opponentMovesElement = document.getElementById('player2Moves');
        if (opponentMovesElement) {
            opponentMovesElement.textContent = data.moves;
        }
        
        // Update player list with current moves if it exists
        this.updatePlayerMoveDisplay(data.player_id, data.moves);
    }
    
    updatePlayerMoveDisplay(playerId, moves) {
        // Update moves in player list display
        const playerElement = document.querySelector(`[data-player-id="${playerId}"]`);
        if (playerElement) {
            const movesSpan = playerElement.querySelector('.player-moves');
            if (movesSpan) {
                movesSpan.textContent = `${moves} moves`;
            }
        }
    }

    onGameEnded(data) {
        this.gameFinished = true;
        this.stopTimer();
        
        // Show game result
        const winner = data.winner;
        const finisher = data.finisher;
        const isWinner = winner && winner.player_id === this.playerId;
        const isFinisher = finisher && finisher.player_id === this.playerId;
        
        let message = '';
        if (data.forfeit && data.left_game) {
            if (isWinner) {
                message = `🎉 You won! Your opponent left the game.`;
            } else {
                message = `Game ended - a player left the game.`;
            }
        } else if (data.forfeit) {
            if (isWinner) {
                message = `🎉 You won! Your opponent forfeited.`;
            } else {
                message = `You forfeited the game.`;
            }
        } else if (data.game_mode === 'tournament') {
            if (isFinisher) {
                message = `🎉 You finished in place ${data.placement}!`;
            }
            if (data.tournament_complete && isWinner) {
                message = `� Congratulations! You won the tournament!`;
            }
        } else if (data.game_mode === 'team') {
            if (data.winning_team === this.playerTeam) {
                message = `🎉 Your team won! ${winner.player_name} finished first for Team ${data.winning_team}!`;
            } else {
                message = `😔 Team ${data.winning_team} won! ${winner.player_name} finished first.`;
            }
        } else {
            // Classic or spectator mode
            if (isWinner) {
                message = `🎉 Congratulations! You won in ${winner.moves} moves in ${this.formatTime(winner.time)}!`;
            } else if (winner) {
                message = `😔 ${winner.player_name} won the game in ${winner.moves} moves in ${this.formatTime(winner.time)}!`;
            } else {
                message = 'Game ended';
            }
        }
        
        this.showMessage(message, isWinner ? 'success' : (data.forfeit ? 'warning' : 'info'));
        
        // Show option to start a new game or leave room
        setTimeout(() => {
            if (confirm('Game ended. Would you like to start a new game?')) {
                this.newGame();
            }
        }, 2000);
    }

    onPlayerLeft(data) {
        this.showMessage(`${data.player_name} left the game`, 'warning');
        
        // If game was active and only one player remains, suggest returning to lobby
        if (this.gameStarted && !this.gameFinished) {
            setTimeout(() => {
                if (confirm('Your opponent left the game. Would you like to return to the lobby?')) {
                    this.leaveRoom();
                }
            }, 2000);
        }
    }

    onPlayerReset(data) {
        if (data.player_id === this.playerId) {
            // Reset own game
            this.initializeGame();
            this.showMessage('Your game has been reset', 'info');
        } else {
            this.showMessage(`${data.player_name} reset their game`, 'info');
        }
    }

    onResetFailed(data) {
        this.showMessage(data.error, 'error');
    }

    onLeftRoom(data) {
        // Redirect back to main page
        window.location.href = '/';
    }

    // Utility methods
    showMessage(message, type = 'info') {
        // Create or update message element
        let messageEl = document.getElementById('gameMessage');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'gameMessage';
            messageEl.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300';
            document.body.appendChild(messageEl);
        }

        // Set message and styling based on type
        messageEl.textContent = message;
        messageEl.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300';
        
        switch (type) {
            case 'success':
                messageEl.className += ' bg-green-500 text-white';
                break;
            case 'error':
                messageEl.className += ' bg-red-500 text-white';
                break;
            case 'warning':
                messageEl.className += ' bg-yellow-500 text-black';
                break;
            default:
                messageEl.className += ' bg-blue-500 text-white';
        }

        // Show message
        messageEl.style.opacity = '1';
        messageEl.style.transform = 'translateX(-50%) translateY(0)';

        // Hide after 3 seconds
        setTimeout(() => {
            messageEl.style.opacity = '0';
            messageEl.style.transform = 'translateX(-50%) translateY(-20px)';
        }, 3000);
    }

    copyInviteLink() {
        const inviteLink = `${window.location.origin}/room/${this.roomId}`;
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(inviteLink).then(() => {
                this.showMessage('Invite link copied to clipboard!', 'success');
            }).catch(err => {
                console.error('Clipboard API failed:', err);
                this.fallbackCopyTextToClipboard(inviteLink);
            });
        } else {
            this.fallbackCopyTextToClipboard(inviteLink);
        }
    }

    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            this.showMessage('Invite link copied to clipboard!', 'success');
        } catch (err) {
            this.showMessage('Failed to copy invite link', 'error');
        }
        document.body.removeChild(textArea);
    }

    forfeitGame() {
        if (this.gameStarted && !this.gameFinished && this.roomId && this.playerId) {
            if (confirm('Are you sure you want to forfeit the game?')) {
                this.socket.emit('forfeit_game', {
                    room_id: this.roomId,
                    player_id: this.playerId
                });
            }
        }
    }

    resetGame() {
        if (this.gameStarted && !this.gameFinished && this.roomId && this.playerId) {
            if (confirm('Are you sure you want to reset your game? This will use one of your reset chances.')) {
                this.socket.emit('reset_game', {
                    room_id: this.roomId,
                    player_id: this.playerId
                });
            }
        }
    }

    newGame() {
        if (confirm('Are you sure you want to start a new game? This will leave the current room.')) {
            this.leaveRoom();
        }
    }

    leaveRoom() {
        if (this.roomId && this.playerId) {
            this.socket.emit('leave_room', {
                room_id: this.roomId,
                player_id: this.playerId
            });
        } else {
            // No room to leave, just reload
            window.location.reload();
        }
    }

    showInvalidMoveAnimation(element) {
        // Add visual feedback for invalid moves
        element.classList.add('invalid-move');
        setTimeout(() => {
            element.classList.remove('invalid-move');
        }, 500);
    }

    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes > 0) {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        } else {
            return `${remainingSeconds}s`;
        }
    }
}

// Global functions for drag and drop (desktop)
let multiplayerGame;

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
        
        if (multiplayerGame && multiplayerGame.moveDisk(diskId, pegIndex)) {
            // Move successful
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
        multiplayerGame = new MultiplayerTowerOfHanoi();
    } catch (error) {
        console.error('Multiplayer game initialization failed:', error);
    }
});

// Remove drop target on drag leave
document.addEventListener('dragleave', (e) => {
    try {
        if (e.target.classList.contains('peg')) {
            e.target.classList.remove('drop-target');
        }
    } catch (error) {
        console.warn('Drag leave error:', error);
    }
});
