from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms
import uuid
import time
from datetime import datetime
import json
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
socketio = SocketIO(app, cors_allowed_origins="*")

# Global storage for game rooms
game_rooms = {}
player_sessions = {}
socket_sessions = {}  # Maps socket IDs to player IDs

class GameRoom:
    def __init__(self, room_id, creator_id, creator_name, game_mode='classic', max_players=2):
        self.room_id = room_id
        self.creator_id = creator_id
        self.creator_name = creator_name
        self.game_mode = game_mode  # 'classic', 'tournament', 'team', 'spectator'
        self.max_players = max_players
        self.players = {creator_id: {
            'name': creator_name, 
            'ready': False, 
            'game_state': None, 
            'resets_used': 0,
            'role': 'player',  # 'player' or 'spectator'
            'team': None,  # 'A', 'B', or None
            'placement': None  # For tournament ranking
        }}
        self.spectators = {}
        self.teams = {'A': [], 'B': []}  # Team assignments
        self.game_started = False
        self.game_finished = False
        self.winner = None
        self.winning_team = None
        self.forfeit_winner = None
        self.leaderboard = []  # For tournament mode
        self.created_at = datetime.now()
        self.disk_count = 4
        self.max_resets = 2
        
    def add_player(self, player_id, player_name, role='player', team=None):
        active_players = [p for p in self.players.values() if p['role'] == 'player']
        
        if role == 'spectator':
            # Spectators can always join
            self.spectators[player_id] = {
                'name': player_name, 
                'role': 'spectator'
            }
            return True
        elif role == 'player':
            if len(active_players) < self.max_players and player_id not in self.players:
                player_data = {
                    'name': player_name, 
                    'ready': False, 
                    'game_state': None, 
                    'resets_used': 0,
                    'role': 'player',
                    'team': team,
                    'placement': None
                }
                
                self.players[player_id] = player_data
                
                # Auto-assign to team if in team mode
                if self.game_mode == 'team' and team:
                    if team in self.teams:
                        self.teams[team].append(player_id)
                
                return True
        return False
    
    def remove_player(self, player_id):
        removed_from_teams = False
        
        # Remove from teams if applicable
        for team_name, team_members in self.teams.items():
            if player_id in team_members:
                team_members.remove(player_id)
                removed_from_teams = True
        
        # Remove from players or spectators
        if player_id in self.players:
            del self.players[player_id]
        elif player_id in self.spectators:
            del self.spectators[player_id]
        
        # Check if room should be deleted (no players left)
        active_players = [p for p in self.players.values() if p['role'] == 'player']
        if len(active_players) == 0:
            return True  # Room should be deleted
        return False
    
    def start_game(self):
        active_players = [p for p in self.players.values() if p['role'] == 'player']
        
        if self.game_mode == 'classic':
            # Classic mode: exactly 2 players
            min_players = 2
            max_players = 2
        elif self.game_mode == 'tournament':
            # Tournament mode: 3-8 players
            min_players = 3
            max_players = 8
        elif self.game_mode == 'team':
            # Team mode: 4-6 players (2v2 or 3v3)
            min_players = 4
            max_players = 6
        elif self.game_mode == 'spectator':
            # Spectator mode: 2 players + spectators
            min_players = 2
            max_players = 2
        else:
            min_players = 2
            max_players = 2
        
        if (len(active_players) >= min_players and 
            len(active_players) <= max_players and 
            not self.game_started):
            
            self.game_started = True
            self.game_finished = False
            self.winner = None
            self.winning_team = None
            self.leaderboard = []
            
            # Reset player game states
            for player in self.players.values():
                if player['role'] == 'player':
                    player['game_state'] = {
                        'moves': 0,
                        'start_time': time.time(),
                        'finished': False,
                        'finish_time': None
                    }
                    player['placement'] = None
            return True
        return False
    
    def finish_game(self, player_id, moves, finish_time):
        if player_id in self.players and self.game_started and not self.game_finished:
            self.players[player_id]['game_state']['finished'] = True
            self.players[player_id]['game_state']['moves'] = moves
            self.players[player_id]['game_state']['finish_time'] = finish_time
            
            # Handle different game modes
            if self.game_mode == 'tournament':
                # Tournament mode: track all finishers
                finished_players = [p for p in self.players.values() 
                                  if p.get('game_state', {}).get('finished', False)]
                
                placement = len(finished_players)
                self.players[player_id]['placement'] = placement
                
                if placement == 1:
                    self.winner = player_id
                
                # Update leaderboard
                self.leaderboard.append({
                    'player_id': player_id,
                    'name': self.players[player_id]['name'],
                    'placement': placement,
                    'moves': moves,
                    'time': finish_time
                })
                
                # Game ends when all players finish or first place is decided
                if placement == 1:
                    return True
                    
            elif self.game_mode == 'team':
                # Team mode: first team member to finish wins for team
                player_team = self.players[player_id]['team']
                if player_team and not self.winning_team:
                    self.winning_team = player_team
                    self.winner = player_id
                    self.game_finished = True
                    return True
                    
            else:
                # Classic/Spectator mode: first to finish wins
                if not self.winner:
                    self.winner = player_id
                    self.game_finished = True
                    return True
        return False
    
    def forfeit_game(self, player_id):
        if player_id in self.players and self.game_started and not self.game_finished:
            if self.game_mode == 'team':
                # Team mode: player's team forfeits
                player_team = self.players[player_id]['team']
                other_team = 'B' if player_team == 'A' else 'A'
                
                if self.teams[other_team]:  # Other team exists
                    self.winning_team = other_team
                    # Set winner as first player from winning team
                    self.winner = self.teams[other_team][0]
                    self.forfeit_winner = self.winner
                    self.game_finished = True
                    return True
                    
            elif self.game_mode == 'tournament':
                # Tournament mode: player gets last place
                active_players = [p for p in self.players.values() if p['role'] == 'player']
                self.players[player_id]['placement'] = len(active_players)
                
                # If only one player left, they win
                remaining_players = [p for pid, p in self.players.items() 
                                   if p['role'] == 'player' and 
                                      not p.get('game_state', {}).get('finished', False) and 
                                      pid != player_id]
                
                if len(remaining_players) <= 1:
                    if remaining_players:
                        self.winner = list(self.players.keys())[list(self.players.values()).index(remaining_players[0])]
                        self.forfeit_winner = self.winner
                        self.game_finished = True
                        return True
                        
            else:
                # Classic/Spectator mode: other player wins
                other_player_id = None
                for pid in self.players.keys():
                    if pid != player_id:
                        other_player_id = pid
                        break
                
                if other_player_id:
                    self.winner = other_player_id
                    self.forfeit_winner = other_player_id
                    self.game_finished = True
                    return True
        return False
    
    def reset_game(self, player_id):
        if (player_id in self.players and 
            self.game_started and 
            not self.game_finished and 
            self.players[player_id]['resets_used'] < self.max_resets):
            
            self.players[player_id]['resets_used'] += 1
            
            # Reset game state for this player
            if self.players[player_id]['game_state']:
                self.players[player_id]['game_state'] = {
                    'moves': 0,
                    'start_time': time.time(),
                    'finished': False,
                    'finish_time': None
                }
            return True
        return False
    
    def can_reset(self, player_id):
        if player_id in self.players:
            return self.players[player_id]['resets_used'] < self.max_resets
        return False
    
    def get_room_info(self):
        return {
            'room_id': self.room_id,
            'creator_name': self.creator_name,
            'game_mode': self.game_mode,
            'max_players': self.max_players,
            'players': {
                pid: {
                    'name': pinfo['name'], 
                    'ready': pinfo['ready'],
                    'resets_used': pinfo['resets_used'],
                    'can_reset': self.can_reset(pid),
                    'role': pinfo['role'],
                    'team': pinfo['team'],
                    'placement': pinfo['placement']
                } for pid, pinfo in self.players.items()
            },
            'spectators': self.spectators,
            'teams': self.teams,
            'game_started': self.game_started,
            'game_finished': self.game_finished,
            'winner': self.players[self.winner]['name'] if self.winner and self.winner in self.players else None,
            'winning_team': self.winning_team,
            'forfeit_winner': self.forfeit_winner,
            'leaderboard': self.leaderboard,
            'disk_count': self.disk_count,
            'max_resets': self.max_resets,
            'player_count': len([p for p in self.players.values() if p['role'] == 'player']),
            'spectator_count': len(self.spectators)
        }

@app.route('/')
def index():
    return render_template('multiplayer.html')

@app.route('/create-room', methods=['POST'])
def create_room():
    data = request.get_json()
    player_name = data.get('player_name', 'Anonymous')
    disk_count = data.get('disk_count', 4)
    game_mode = data.get('game_mode', 'classic')  # classic, tournament, team, spectator
    
    # Determine max players based on game mode
    if game_mode == 'tournament':
        max_players = data.get('max_players', 8)  # 3-8 players
        max_players = max(3, min(8, max_players))
    elif game_mode == 'team':
        max_players = data.get('max_players', 4)  # 4-6 players
        max_players = max(4, min(6, max_players))
    elif game_mode == 'spectator':
        max_players = 2  # 2 players + unlimited spectators
    else:  # classic
        max_players = 2
    
    room_id = str(uuid.uuid4())[:8]  # Short room ID
    player_id = str(uuid.uuid4())
    
    # Create new room
    room = GameRoom(room_id, player_id, player_name, game_mode, max_players)
    room.disk_count = disk_count
    game_rooms[room_id] = room
    player_sessions[player_id] = room_id
    
    return jsonify({
        'success': True,
        'room_id': room_id,
        'player_id': player_id,
        'game_mode': game_mode,
        'max_players': max_players,
        'invite_link': f'/room/{room_id}'
    })

@app.route('/join-room', methods=['POST'])
def join_room_api():
    data = request.get_json()
    room_id = data.get('room_id')
    player_name = data.get('player_name', 'Anonymous')
    role = data.get('role', 'player')  # 'player' or 'spectator'
    team = data.get('team', None)  # 'A' or 'B' for team mode
    
    if room_id not in game_rooms:
        return jsonify({'success': False, 'error': 'Room not found'})
    
    room = game_rooms[room_id]
    
    # Check if game already started
    if room.game_started and role == 'player':
        return jsonify({'success': False, 'error': 'Game already started, you can join as spectator'})
    
    # Check room capacity
    active_players = [p for p in room.players.values() if p['role'] == 'player']
    if role == 'player' and len(active_players) >= room.max_players:
        return jsonify({'success': False, 'error': 'Room is full, you can join as spectator'})
    
    player_id = str(uuid.uuid4())
    if room.add_player(player_id, player_name, role, team):
        player_sessions[player_id] = room_id
        return jsonify({
            'success': True,
            'room_id': room_id,
            'player_id': player_id,
            'role': role,
            'team': team
        })
    
    return jsonify({'success': False, 'error': 'Failed to join room'})

@app.route('/room/<room_id>')
def room_page(room_id):
    if room_id not in game_rooms:
        return redirect(url_for('index'))
    return render_template('multiplayer.html', room_id=room_id)

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')
    
    # Find player ID from socket session
    player_id = socket_sessions.get(request.sid)
    if player_id and player_id in player_sessions:
        room_id = player_sessions[player_id]
        
        if room_id in game_rooms:
            room = game_rooms[room_id]
            player_name = room.players.get(player_id, {}).get('name', 'Unknown Player')
            
            # If game is active, this counts as a forfeit
            if room.game_started and not room.game_finished and player_id in room.players:
                if room.forfeit_game(player_id):
                    winner_info = {
                        'player_id': room.winner,
                        'player_name': room.players[room.winner]['name']
                    }
                    socketio.emit('game_ended', {
                        'winner': winner_info,
                        'forfeit': True,
                        'left_game': True,
                        'room_info': room.get_room_info()
                    }, room=room_id)
            
            if room.remove_player(player_id):
                # Room is empty, delete it
                del game_rooms[room_id]
            else:
                # Notify other players about player leaving
                socketio.emit('player_left', {
                    'player_name': player_name,
                    'room_info': room.get_room_info()
                }, room=room_id)
        
        # Clean up sessions
        if player_id in player_sessions:
            del player_sessions[player_id]
    
    # Clean up socket session
    if request.sid in socket_sessions:
        del socket_sessions[request.sid]

@socketio.on('join_game_room')
def handle_join_game_room(data):
    room_id = data['room_id']
    player_id = data['player_id']
    
    if room_id in game_rooms and player_id in game_rooms[room_id].players:
        join_room(room_id)
        socket_sessions[request.sid] = player_id  # Track socket to player mapping
        emit('room_joined', game_rooms[room_id].get_room_info())
        # Notify all players in room about current state
        socketio.emit('room_update', game_rooms[room_id].get_room_info(), room=room_id)

@socketio.on('player_ready')
def handle_player_ready(data):
    room_id = data['room_id']
    player_id = data['player_id']
    
    if room_id in game_rooms and player_id in game_rooms[room_id].players:
        game_rooms[room_id].players[player_id]['ready'] = True
        socketio.emit('room_update', game_rooms[room_id].get_room_info(), room=room_id)

@socketio.on('start_game')
def handle_start_game(data):
    room_id = data['room_id']
    player_id = data['player_id']
    
    if room_id in game_rooms:
        room = game_rooms[room_id]
        if player_id == room.creator_id:
            active_players = [p for p in room.players.values() if p['role'] == 'player']
            
            # Check if all players are ready
            all_ready = all(player['ready'] for player in active_players)
            
            if all_ready and room.start_game():
                game_info = {
                    'room_info': room.get_room_info(),
                    'disk_count': room.disk_count,
                    'game_mode': room.game_mode
                }
                
                # Send to all players and spectators
                socketio.emit('game_started', game_info, room=room_id)

@socketio.on('game_move')
def handle_game_move(data):
    room_id = data['room_id']
    player_id = data['player_id']
    moves = data['moves']
    
    if room_id in game_rooms and player_id in game_rooms[room_id].players:
        # Broadcast move count to all players in room
        socketio.emit('opponent_move', {
            'player_id': player_id,
            'player_name': game_rooms[room_id].players[player_id]['name'],
            'moves': moves
        }, room=room_id)

@socketio.on('game_finished')
def handle_game_finished(data):
    room_id = data['room_id']
    player_id = data['player_id']
    moves = data['moves']
    time_taken = data['time_taken']
    
    if room_id in game_rooms:
        room = game_rooms[room_id]
        if room.finish_game(player_id, moves, time_taken):
            player_name = room.players[player_id]['name']
            
            game_end_data = {
                'room_info': room.get_room_info(),
                'finisher': player_name,
                'finisher_moves': moves,
                'finisher_time': time_taken
            }
            
            if room.game_mode == 'tournament':
                game_end_data.update({
                    'winner': player_name,
                    'placement': room.players[player_id]['placement'],
                    'leaderboard': room.leaderboard,
                    'tournament_complete': room.game_finished
                })
            elif room.game_mode == 'team':
                game_end_data.update({
                    'winning_team': room.winning_team,
                    'winner': player_name,
                    'team_victory': True
                })
            else:
                game_end_data.update({
                    'winner': player_name,
                    'winner_moves': moves,
                    'winner_time': time_taken
                })
            
            socketio.emit('game_ended', game_end_data, room=room_id)

@socketio.on('set_disk_count')
def handle_set_disk_count(data):
    room_id = data['room_id']
    player_id = data['player_id']
    disk_count = data['disk_count']
    
    if room_id in game_rooms:
        room = game_rooms[room_id]
        if player_id == room.creator_id and not room.game_started:
            room.disk_count = disk_count
            socketio.emit('room_update', room.get_room_info(), room=room_id)

@socketio.on('forfeit_game')
def handle_forfeit_game(data):
    room_id = data['room_id']
    player_id = data['player_id']
    
    if room_id in game_rooms:
        room = game_rooms[room_id]
        if room.forfeit_game(player_id):
            # Notify all players that someone forfeited
            winner_name = room.players[room.winner]['name']
            loser_name = room.players[player_id]['name']
            socketio.emit('game_ended', {
                'winner': winner_name,
                'loser': loser_name,
                'forfeit': True,
                'room_info': room.get_room_info()
            }, room=room_id)

@socketio.on('reset_game')
def handle_reset_game(data):
    room_id = data['room_id']
    player_id = data['player_id']
    
    if room_id in game_rooms:
        room = game_rooms[room_id]
        if room.reset_game(player_id):
            # Notify all players about the reset
            player_name = room.players[player_id]['name']
            resets_left = room.max_resets - room.players[player_id]['resets_used']
            socketio.emit('player_reset', {
                'player_id': player_id,
                'player_name': player_name,
                'resets_left': resets_left,
                'room_info': room.get_room_info()
            }, room=room_id)
        else:
            # Player can't reset (out of resets or game not active)
            emit('reset_failed', {
                'error': 'Cannot reset: out of resets or game not active',
                'resets_used': room.players[player_id]['resets_used'] if player_id in room.players else 0,
                'max_resets': room.max_resets
            })

@socketio.on('leave_room')
def handle_leave_room(data):
    room_id = data['room_id']
    player_id = data['player_id']
    
    if room_id in game_rooms and player_id in game_rooms[room_id].players:
        room = game_rooms[room_id]
        player_name = room.players[player_id]['name']
        
        # If game is active, this counts as a forfeit
        if room.game_started and not room.game_finished:
            if room.forfeit_game(player_id):
                winner_info = {
                    'player_id': room.winner,
                    'player_name': room.players[room.winner]['name']
                }
                socketio.emit('game_ended', {
                    'winner': winner_info,
                    'forfeit': True,
                    'left_game': True,
                    'room_info': room.get_room_info()
                }, room=room_id)
        
        # Remove player from room
        if room.remove_player(player_id):
            # Room is empty, delete it
            del game_rooms[room_id]
        else:
            # Notify remaining players
            socketio.emit('player_left', {
                'player_name': player_name,
                'room_info': room.get_room_info()
            }, room=room_id)
        
        # Clean up player session
        if player_id in player_sessions:
            del player_sessions[player_id]
            
        # Clean up socket session
        if request.sid in socket_sessions:
            del socket_sessions[request.sid]
        
        # Remove from socket room
        leave_room(room_id)
        emit('left_room', {'success': True})

@socketio.on('join_team')
def handle_join_team(data):
    room_id = data['room_id']
    player_id = data['player_id']
    team = data['team']  # 'A' or 'B'
    
    if room_id in game_rooms and player_id in game_rooms[room_id].players:
        room = game_rooms[room_id]
        
        # Remove from current team
        for team_name, team_members in room.teams.items():
            if player_id in team_members:
                team_members.remove(player_id)
        
        # Add to new team
        if team in room.teams and len(room.teams[team]) < room.max_players // 2:
            room.teams[team].append(player_id)
            room.players[player_id]['team'] = team
            
            socketio.emit('room_update', room.get_room_info(), room=room_id)
        else:
            emit('team_join_failed', {'error': 'Team is full or invalid'})

@socketio.on('set_game_mode')
def handle_set_game_mode(data):
    room_id = data['room_id']
    player_id = data['player_id']
    game_mode = data['game_mode']
    max_players = data.get('max_players', 2)
    
    if room_id in game_rooms:
        room = game_rooms[room_id]
        if player_id == room.creator_id and not room.game_started:
            room.game_mode = game_mode
            
            # Adjust max players based on mode
            if game_mode == 'tournament':
                room.max_players = max(3, min(8, max_players))
            elif game_mode == 'team':
                room.max_players = max(4, min(6, max_players))
            elif game_mode == 'spectator':
                room.max_players = 2
            else:  # classic
                room.max_players = 2
            
            socketio.emit('room_update', room.get_room_info(), room=room_id)

@socketio.on('switch_to_spectator')
def handle_switch_to_spectator(data):
    room_id = data['room_id']
    player_id = data['player_id']
    
    if room_id in game_rooms and player_id in game_rooms[room_id].players:
        room = game_rooms[room_id]
        
        # Move player to spectator
        player_info = room.players[player_id]
        room.spectators[player_id] = {
            'name': player_info['name'],
            'role': 'spectator'
        }
        
        # Remove from teams
        for team_name, team_members in room.teams.items():
            if player_id in team_members:
                team_members.remove(player_id)
        
        # Remove from players
        del room.players[player_id]
        
        socketio.emit('room_update', room.get_room_info(), room=room_id)

@socketio.on('switch_to_player')
def handle_switch_to_player(data):
    room_id = data['room_id']
    player_id = data['player_id']
    team = data.get('team', None)
    
    if room_id in game_rooms and player_id in game_rooms[room_id].spectators:
        room = game_rooms[room_id]
        
        # Check if room has space for more players
        active_players = [p for p in room.players.values() if p['role'] == 'player']
        if len(active_players) < room.max_players and not room.game_started:
            # Move spectator to player
            spectator_info = room.spectators[player_id]
            room.players[player_id] = {
                'name': spectator_info['name'],
                'ready': False,
                'game_state': None,
                'resets_used': 0,
                'role': 'player',
                'team': team,
                'placement': None
            }
            
            # Add to team if specified
            if team in room.teams:
                room.teams[team].append(player_id)
            
            # Remove from spectators
            del room.spectators[player_id]
            
            socketio.emit('room_update', room.get_room_info(), room=room_id)
        else:
            emit('player_switch_failed', {'error': 'Room is full or game started'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    socketio.run(app, 
                debug=debug, 
                host='0.0.0.0', 
                port=port,
                allow_unsafe_werkzeug=True)
