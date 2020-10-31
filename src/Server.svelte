<script lang="ts">
  import Peer from "peerjs";
  import { onMount } from "svelte";
  let out_url = "";
  let peer: Peer;
  let connections: Peer.DataConnection[] = [];
  let users: [string, string][] = [];

  function createPeer() {
    peer = new Peer();
    peer.on("open", function (id) {
      console.log("My peer ID is: " + id);
      out_url = location.href + "#" + peer.id;
    });

    peer.on("error", (err) => console.error(err));

    peer.on("connection", (conn) => {
      console.log("CONNECTED! with connection:");
      console.log(conn);
      connections.push(conn);
      console.log(users);
      conn.on("data", (data) => {
        conn.send(
          JSON.stringify({
            type: "old_users",
            users: users,
          })
        );
        console.log("got data:", data);
        const obj = JSON.parse(data);
        console.log(obj);
        if (obj.type === "new_user") {
          users = [...users, [obj.username, obj.img_src]];
        }
        for (let oc of connections) {
          oc.send(data);
        }
      });
      conn.on("close", () => {
        if (connections.includes(conn)) {
          console.log("deleting connection");
          console.log(connections);
          connections = connections.splice(connections.indexOf(conn), 1);
          console.log(connections);
        } else {
          console.error("trying to delete missing connection");
        }
      });
    });

    return peer;
  }

  let gameStarted = false;

  function startGame() {
    for (let conn of connections) {
      conn.send(JSON.stringify({ type: "start_game" }));
    }
    gameStarted = true;
  }

  onMount(async () => {
    peer = createPeer();
  });
</script>

<svelte:head>
  <title>WebRTCRelayServer</title>
</svelte:head>

<h1 class="title has-text-centered">
  WebRTCRelayServer server tab: send this link to players, then press the button
</h1>

<a href={out_url}>{out_url}</a>

<p>Logged users:</p>
<ul>
  {#each users as user}
    <li>{user}</li>
  {/each}
</ul>

<button
  class="button"
  on:click|once={startGame}
  disabled={users.length < 2 || gameStarted}>
  Everybody in!
</button>
