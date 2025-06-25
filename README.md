# Tower of Hanoi - Advanced Multiplayer Server

A comprehensive real-time multiplayer Tower of Hanoi game with multiple game modes, team battles, tournaments, and spectator support.

## 🎮 Game Modes

### 1. **Classic Mode (1v1)**
- Traditional head-to-head competition
- 2 players race to solve the puzzle
- First to complete wins

### 2. **Tournament Mode (3-8 players)**
- Multi-player competition
- 3 to 8 players compete simultaneously
- Rankings based on completion order
- Leaderboard tracking

### 3. **Team Battle Mode (2v2, 3v3)**
- Team-based competition
- Players join Team A or Team B
- First team member to complete wins for their team
- Supports 4-6 total players

### 4. **Spectator Mode**
- 2 active players + unlimited spectators
- Spectators can watch games in real-time
- Players can switch between player/spectator roles

## 🌟 Enhanced Features

### 🎯 Gameplay Features
- **Multiple Difficulty Levels**: 3-7 disks per game
- **Forfeit System**: Players can forfeit if needed
- **Reset System**: 2 resets per player per game
- **Leave Room**: Safe room leaving with forfeit handling
- **Real-time Updates**: Live game state synchronization

### 👥 Social Features
- **Room Creation**: Custom rooms with invite links
- **Team Assignment**: Join specific teams in team mode
- **Role Switching**: Switch between player and spectator
- **Player Management**: Ready system and game start control

### 📱 Technical Features
- **Mobile Responsive**: Touch controls for all devices
- **Dark Mode**: Theme switching support
- **Error Handling**: Robust error recovery
- **Cross-platform**: Works on all modern browsers

## Installation

1. **Install Python Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Server**
   ```bash
   python server.py
   ```

3. **Access the Game**
   - Open your browser to `http://localhost:5000`
   - For network play: `http://your-ip:5000`

## How to Play

### Creating a Room
1. **Choose Game Mode**:
   - **Classic**: 1v1 competition
   - **Tournament**: 3-8 player competition
   - **Team Battle**: 2v2 or 3v3 teams
   - **Spectator**: 2 players + viewers

2. **Configure Settings**:
   - Enter your name
   - Select number of disks (3-7)
   - Set max players (for tournament/team modes)
   - Click "Create Room"

3. **Share Room**: Copy the invite link to share with friends

### Joining a Room
1. **Enter Details**:
   - Your name
   - Room ID (or use invite link)
   
2. **Choose Role**:
   - **Player**: Actively compete in the game
   - **Spectator**: Watch the game without playing
   
3. **Select Team** (Team Mode):
   - Join Team A (🔴) or Team B (🔵)
   - Teams are balanced automatically

### Gameplay Controls
- **Desktop**: Drag and drop disks with mouse
- **Mobile**: Touch and drag disks
- **Game Controls**:
  - 🔄 **Reset**: Restart your puzzle (2 uses per game)
  - 🏳️ **Forfeit**: Give up and let opponent win
  - 🚪 **Leave**: Exit the room safely

### Winning Conditions
- **Classic/Spectator**: First player to complete wins
- **Tournament**: Rankings based on completion order
- **Team Battle**: First team member to complete wins for their team

## Game Modes Explained

### 🎯 Classic Mode
- **Players**: Exactly 2
- **Objective**: Beat your opponent in a 1v1 race
- **Winner**: First to move all disks to destination

### 🏆 Tournament Mode  
- **Players**: 3-8 players
- **Objective**: Compete against multiple opponents
- **Winner**: First to complete (others can continue for rankings)
- **Features**: Live leaderboard, placement tracking

### 👥 Team Battle Mode
- **Players**: 4-6 players (2v2 or 3v3)
- **Teams**: Team A (🔴) vs Team B (🔵)
- **Objective**: First team member to complete wins for entire team
- **Strategy**: Coordinate with teammates

### 👁️ Spectator Mode
- **Active Players**: 2
- **Spectators**: Unlimited
- **Features**: 
  - Watch games in real-time
  - Switch between player/spectator roles
  - See live move counters and timers

## Server Architecture

### Backend (Python Flask + SocketIO)
```
server.py
├── Flask web server
├── WebSocket handling with Flask-SocketIO
├── Room management system
├── Real-time game state synchronization
└── Winner detection and scoring
```

### Frontend (HTML + JavaScript + CSS)
```
templates/multiplayer.html    # Main game interface
static/multiplayer.js         # Game logic and WebSocket client
static/styles.css            # Responsive styling
```

### Key Components

#### GameRoom Class
- Manages room state and players
- Handles game start/finish logic
- Tracks moves and timing
- Determines winners

#### WebSocket Events
- `join_game_room`: Player joins a room
- `player_ready`: Player marks themselves ready
- `start_game`: Creator starts the game
- `game_move`: Real-time move updates
- `game_finished`: Player completes puzzle

#### Client-Side Game Engine
- Touch and mouse drag-and-drop
- Mobile-responsive disk rendering
- Real-time opponent move tracking
- Victory condition detection

## File Structure

```
tower-of-hanoi/
├── server.py              # Flask server with WebSocket support
├── requirements.txt       # Python dependencies
├── templates/
│   └── multiplayer.html   # Game interface template
├── static/
│   ├── multiplayer.js     # Client-side game logic
│   └── styles.css         # Responsive CSS styling
├── index.html            # Original single-player version
└── script.js             # Original single-player logic
```

## Network Deployment

### Local Network
```bash
python server.py
# Access at http://your-local-ip:5000
```

### Cloud Deployment (Example with Heroku)
1. Add `Procfile`:
   ```
   web: python server.py
   ```
2. Deploy to Heroku, Railway, or similar platform
3. Update any hardcoded URLs if necessary

### Port Configuration
- Default: Port 5000
- Change in `server.py`: `socketio.run(app, port=YOUR_PORT)`

## Security Considerations

- **Room IDs**: Generated with UUID for uniqueness
- **Player Sessions**: Temporary session management
- **Input Validation**: Server-side move validation
- **Error Handling**: Graceful failure recovery

## Performance

### Optimizations
- **Client-side**: Hardware acceleration for mobile
- **Server-side**: Efficient room cleanup
- **Network**: Minimal WebSocket message payload
- **UI**: Responsive design with minimal DOM manipulation

### Scaling
- Current: Supports hundreds of concurrent rooms
- Memory: Automatic room cleanup when empty
- Network: Efficient WebSocket broadcasting

## Browser Compatibility

### Supported Browsers
- ✅ Chrome/Chromium (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)
- ✅ Safari (Desktop & Mobile)
- ✅ Edge (Desktop & Mobile)

### Required Features
- WebSocket support
- ES6+ JavaScript
- CSS Grid and Flexbox
- Touch events (mobile)

## Troubleshooting

### Common Issues

1. **"Room not found"**
   - Check Room ID spelling
   - Room may have expired or been deleted

2. **Connection issues**
   - Verify server is running
   - Check firewall settings
   - Ensure WebSocket support in browser

3. **Mobile touch not working**
   - Ensure mobile browser supports touch events
   - Check if page is properly loaded

4. **Game doesn't start**
   - Both players must click "Ready"
   - Only room creator can start the game

### Debug Mode
Enable Flask debug mode in `server.py`:
```python
socketio.run(app, debug=True, host='0.0.0.0', port=5000)
```

## Contributing

Feel free to contribute by:
- Adding new game features
- Improving mobile responsiveness
- Enhancing the UI/UX
- Optimizing performance
- Adding new game modes

## License

This project is open source and available under the MIT License.
