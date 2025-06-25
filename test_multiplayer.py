import requests
import json

def test_room_creation():
    """Test creating rooms with different game modes"""
    base_url = "http://localhost:5000"
    
    # Test classic mode
    print("Testing Classic Mode (1v1)...")
    response = requests.post(f"{base_url}/create-room", 
                           json={
                               "player_name": "TestPlayer1",
                               "disk_count": 4,
                               "game_mode": "classic"
                           })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Classic room created: {data['room_id']}")
    else:
        print(f"❌ Failed to create classic room: {response.text}")
    
    # Test tournament mode
    print("\nTesting Tournament Mode (3-8 players)...")
    response = requests.post(f"{base_url}/create-room", 
                           json={
                               "player_name": "TournamentHost",
                               "disk_count": 5,
                               "game_mode": "tournament",
                               "max_players": 6
                           })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Tournament room created: {data['room_id']} (max {data['max_players']} players)")
    else:
        print(f"❌ Failed to create tournament room: {response.text}")
    
    # Test team mode
    print("\nTesting Team Mode (2v2, 3v3)...")
    response = requests.post(f"{base_url}/create-room", 
                           json={
                               "player_name": "TeamCaptain",
                               "disk_count": 4,
                               "game_mode": "team",
                               "max_players": 4
                           })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Team room created: {data['room_id']} (max {data['max_players']} players)")
    else:
        print(f"❌ Failed to create team room: {response.text}")
    
    # Test spectator mode
    print("\nTesting Spectator Mode (2 players + viewers)...")
    response = requests.post(f"{base_url}/create-room", 
                           json={
                               "player_name": "SpectatorHost",
                               "disk_count": 3,
                               "game_mode": "spectator"
                           })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Spectator room created: {data['room_id']}")
    else:
        print(f"❌ Failed to create spectator room: {response.text}")

def test_join_room():
    """Test joining rooms with different roles"""
    print("\n" + "="*50)
    print("🧪 TESTING ROOM JOINING")
    print("="*50)
    
    # First create a team room to join
    base_url = "http://localhost:5000"
    
    response = requests.post(f"{base_url}/create-room", 
                           json={
                               "player_name": "TeamHost",
                               "disk_count": 4,
                               "game_mode": "team",
                               "max_players": 4
                           })
    
    if response.status_code != 200:
        print("❌ Failed to create test room for joining")
        return
    
    room_data = response.json()
    room_id = room_data['room_id']
    print(f"Created test room: {room_id}")
    
    # Test joining as player
    print("\nTesting join as player...")
    response = requests.post(f"{base_url}/join-room", 
                           json={
                               "room_id": room_id,
                               "player_name": "Player2",
                               "role": "player",
                               "team": "B"
                           })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Joined as player on team {data['team']}")
    else:
        print(f"❌ Failed to join as player: {response.text}")
    
    # Test joining as spectator
    print("\nTesting join as spectator...")
    response = requests.post(f"{base_url}/join-room", 
                           json={
                               "room_id": room_id,
                               "player_name": "Spectator1",
                               "role": "spectator"
                           })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Joined as spectator")
    else:
        print(f"❌ Failed to join as spectator: {response.text}")

if __name__ == "__main__":
    print("🎮 TOWER OF HANOI MULTIPLAYER SERVER TEST")
    print("="*50)
    print("🧪 TESTING ROOM CREATION")
    print("="*50)
    
    try:
        test_room_creation()
        test_join_room()
        print("\n" + "="*50)
        print("✅ ALL TESTS COMPLETED!")
        print("="*50)
        print("\n🎯 GAME MODES SUPPORTED:")
        print("   • Classic Mode: 1v1 competition")
        print("   • Tournament Mode: 3-8 players compete")
        print("   • Team Mode: 2v2 or 3v3 team battles")
        print("   • Spectator Mode: 2 players + unlimited viewers")
        print("\n🚀 Start the server with: python server.py")
        print("🌐 Access the game at: http://localhost:5000")
        
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Cannot connect to server!")
        print("Please start the server first with: python server.py")
    except Exception as e:
        print(f"❌ ERROR: {e}")
