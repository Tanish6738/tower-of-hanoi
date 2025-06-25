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
            document.getElementById('roomIdInput').value = roomMatch[1];
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
        // Room creation/joining
        document.getElementById('createRoomBtn').addEventListener('click', () => this.createRoom());
        document.getElementById('joinRoomBtn').addEventListener('click', () => this.joinRoom());
        document.getElementById('readyBtn').addEventListener('click', () => this.playerReady());
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('copyInviteBtn').addEventListener('click', () => this.copyInviteLink());
        document.getElementById('leaveRoomBtn').addEventListener('click', () => this.leaveRoom());
        document.getElementById('newGameBtn').addEventListener('click', () => this.newGame());
        document.getElementById('darkModeToggle').addEventListener('click', () => this.toggleDarkMode());
        
        // Game control buttons
        const forfeitBtn = document.getElementById('forfeitBtn');
        const resetBtn = document.getElementById('resetBtn');
        const leaveGameBtn = document.getElementById('leaveGameBtn');
        if (forfeitBtn) forfeitBtn.addEventListener('click', () => this.forfeitGame());
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetGame());
        if (leaveGameBtn) leaveGameBtn.addEventListener('click', () => this.leaveRoom());

        // Enter key support
        document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const roomId = document.getElementById('roomIdInput').value.trim();
                if (roomId) {
                    this.joinRoom();
                } else {
                    this.createRoom();
                }
            }
        });

        document.getElementById('roomIdInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });
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
        const playerName = document.getElementById('playerNameInput').value.trim();
        const diskCount = parseInt(document.getElementById('diskCountSelect').value);
        const gameMode = document.getElementById('gameModeSelect').value;
        const maxPlayers = parseInt(document.getElementById('maxPlayersSelect').value) || 2;
        
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

            const data = await response.json();
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
                alert('Failed to create room: ' + data.error);
            }
        } catch (error) {
            alert('Error creating room: ' + error.message);
        }
    }

    async joinRoom() {
        const playerName = document.getElementById('playerNameInput').value.trim();
        const roomId = document.getElementById('roomIdInput').value.trim();
        const role = document.getElementById('joinRoleSelect').value;
        const team = document.getElementById('teamSelect').value;
        
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

            const data = await response.json();
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
                alert('Failed to join room: ' + data.error);
            }
        } catch (error) {
            alert('Error joining room: ' + error.message);
        }
    }

    joinGameRoom() {
        this.socket.emit('join_game_room', {
            room_id: this.roomId,
            player_id: this.playerId
        });
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
        document.getElementById('currentRoomId').textContent = roomInfo.room_id;
        document.getElementById('currentDiskCount').textContent = roomInfo.disk_count;
        this.diskCount = roomInfo.disk_count;

        // Update players display
        const container = document.getElementById('playersContainer');
        container.innerHTML = '';

        Object.entries(roomInfo.players).forEach(([playerId, playerInfo]) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'p-4 border border-gray-200 dark:border-gray-600 rounded-lg';
            
            const isCurrentPlayer = playerId === this.playerId;
            const statusIcon = playerInfo.ready ? '✅' : '⏳';
            const bgColor = isCurrentPlayer ? 'bg-blue-50 dark:bg-blue-900' : 'bg-gray-50 dark:bg-gray-700';
            
            playerDiv.className += ` ${bgColor}`;
            
            let resetInfo = '';
            if (roomInfo.game_started && playerInfo.resets_used !== undefined) {
                const resetsLeft = roomInfo.max_resets - playerInfo.resets_used;
                resetInfo = `<div class="text-xs text-gray-500 dark:text-gray-400">Resets: ${resetsLeft}/${roomInfo.max_resets}</div>`;
            }
            
            playerDiv.innerHTML = `
                <div class="font-semibold ${isCurrentPlayer ? 'text-blue-800 dark:text-blue-200' : 'text-gray-800 dark:text-gray-200'}">
                    ${playerInfo.name} ${isCurrentPlayer ? '(You)' : ''}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                    ${statusIcon} ${playerInfo.ready ? 'Ready' : 'Not Ready'}
                </div>
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
        this.diskCount = data.disk_count;
        this.initializeGame();
        this.showGameArea();
        
        // Set up player names in game area
        const players = Object.values(data.room_info.players);
        document.getElementById('player1Name').textContent = this.playerName;
        document.getElementById('player2Name').textContent = players.find(p => p.name !== this.playerName)?.name || 'Opponent';
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
        } else {
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
                
                const bottom = 20 + (diskIndex * 26);
                diskElement.style.bottom = `${bottom}px`;
                diskElement.style.left = '50%';
                diskElement.style.transform = 'translateX(-50%)';
            });
        });
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

    handleDragStart(e) {
        const diskId = parseInt(e.target.dataset.diskId);
        const pegIndex = this.findDiskPeg(diskId);
        
        if (pegIndex !== -1 && this.isTopDisk(diskId, pegIndex)) {
            e.dataTransfer.setData('text/plain', diskId);
            e.target.classList.add('dragging');
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

    moveDisk(diskId, targetPegIndex) {
        const sourcePegIndex = this.findDiskPeg(diskId);
        
        if (sourcePegIndex === -1 || sourcePegIndex === targetPegIndex) {
            return false;
        }

        const sourcePeg = this.pegs[sourcePegIndex];
        const targetPeg = this.pegs[targetPegIndex];
        const disk = sourcePeg[sourcePeg.length - 1];

        if (disk.id !== diskId) {
            return false;
        }

        if (targetPeg.length > 0 && targetPeg[targetPeg.length - 1].size < disk.size) {
            return false;
        }

        sourcePeg.pop();
        targetPeg.push(disk);
        
        this.moves++;
        this.updateDisplay();
        this.renderDisks();
        
        // Emit move to server
        this.socket.emit('game_move', {
            room_id: this.roomId,
            player_id: this.playerId,
            moves: this.moves
        });
        
        // Check win condition
        if (this.checkWinCondition()) {
            const timeTaken = Math.floor((Date.now() - this.startTime) / 1000);
            this.socket.emit('game_finished', {
                room_id: this.roomId,
                player_id: this.playerId,
                moves: this.moves,
                time_taken: timeTaken
            });
        }
        
        return true;
    }

    checkWinCondition() {
        const lastPeg = this.pegs[2];
        if (lastPeg.length === this.diskCount) {
            for (let i = 0; i < lastPeg.length - 1; i++) {
                if (lastPeg[i].size < lastPeg[i + 1].size) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            document.getElementById('player1Timer').textContent = timeString;
        }, 1000);
    }

    updateDisplay() {
        document.getElementById('player1Moves').textContent = this.moves;
    }

    updateOpponentMoves(data) {
        if (data.player_id !== this.playerId) {
            this.opponentMoves = data.moves;
            document.getElementById('player2Moves').textContent = this.opponentMoves;
        }
    }

    onGameEnded(data) {
        clearInterval(this.timerInterval);
        
        const isWinner = data.winner === this.playerName;
        const modal = document.getElementById('winnerModal');
        const emoji = document.getElementById('winnerEmoji');
        const title = document.getElementById('winnerTitle');
        const message = document.getElementById('winnerMessage');
        const stats = document.getElementById('winnerStats');
        
        emoji.textContent = isWinner ? '🏆' : '😔';
        title.textContent = isWinner ? 'You Won!' : 'You Lost!';
        
        // Handle forfeit scenarios
        if (data.forfeit) {
            if (data.left_game) {
                message.textContent = isWinner ? 
                    `${data.loser} left the game. You win by default!` :
                    `You left the game.`;
            } else {
                message.textContent = isWinner ? 
                    `${data.loser} forfeited the game. You win!` :
                    `You forfeited the game.`;
            }
            stats.innerHTML = `
                <div class="text-center text-lg">
                    <div class="font-semibold text-${isWinner ? 'green' : 'red'}-600 dark:text-${isWinner ? 'green' : 'red'}-400">
                        ${data.forfeit ? 'Game Ended by Forfeit' : 'Normal Victory'}
                    </div>
                </div>
            `;
        } else {
            message.textContent = isWinner ? 
                `Congratulations! You completed the puzzle first!` :
                `${data.winner} completed the puzzle first.`;
            
            stats.innerHTML = `
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <div class="font-semibold text-${isWinner ? 'green' : 'blue'}-600 dark:text-${isWinner ? 'green' : 'blue'}-400">${data.winner_moves}</div>
                        <div class="text-gray-600 dark:text-gray-400">Winner's Moves</div>
                    </div>
                    <div>
                        <div class="font-semibold text-${isWinner ? 'green' : 'blue'}-600 dark:text-${isWinner ? 'green' : 'blue'}-400">${data.winner_time}s</div>
                        <div class="text-gray-600 dark:text-gray-400">Winner's Time</div>
                    </div>
                </div>
            `;
        }
        
        modal.classList.remove('hidden');
    }

    onPlayerLeft(data) {
        alert('Your opponent has left the game.');
        this.leaveRoom();
    }

    onPlayerReset(data) {
        const playerName = data.player_name;
        const resetsLeft = data.resets_left;
        
        if (data.player_id === this.playerId) {
            // This player reset their own game
            this.resetGameState();
            this.showMessage(`You reset your game. ${resetsLeft} resets remaining.`, 'info');
        } else {
            // Opponent reset their game
            this.showMessage(`${playerName} reset their game. They have ${resetsLeft} resets left.`, 'info');
        }
    }

    onResetFailed(data) {
        this.showMessage(data.error, 'error');
    }

    onLeftRoom(data) {
        if (data.success) {
            window.location.reload();
        }
    }

    resetGameState() {
        // Reset the game to initial state
        this.moves = 0;
        this.startTime = Date.now();
        this.initializeGame();
        this.updateMoveCounter();
        this.updateTimer();
    }

    showMessage(message, type = 'info') {
        // Create or update message display
        let messageEl = document.getElementById('gameMessage');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'gameMessage';
            messageEl.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300';
            document.body.appendChild(messageEl);
        }
        
        // Set styling based on type
        messageEl.className = messageEl.className.replace(/bg-\w+-\d+/g, '');
        messageEl.className = messageEl.className.replace(/text-\w+-\d+/g, '');
        
        if (type === 'error') {
            messageEl.className += ' bg-red-500 text-white';
        } else if (type === 'success') {
            messageEl.className += ' bg-green-500 text-white';
        } else {
            messageEl.className += ' bg-blue-500 text-white';
        }
        
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 5000);
    }

    joinTeam(team) {
        if (this.roomId && this.playerId) {
            this.socket.emit('join_team', {
                room_id: this.roomId,
                player_id: this.playerId,
                team: team
            });
        }
    }

    switchToSpectator() {
        if (this.roomId && this.playerId) {
            this.socket.emit('switch_to_spectator', {
                room_id: this.roomId,
                player_id: this.playerId
            });
        }
    }

    switchToPlayer(team = null) {
        if (this.roomId && this.playerId) {
            this.socket.emit('switch_to_player', {
                room_id: this.roomId,
                player_id: this.playerId,
                team: team
            });
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
