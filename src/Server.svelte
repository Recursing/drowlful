<script>
  import { onMount } from "svelte";
  let out_url = "";
  let peer;
  let connections = [];
  let users = [];

  function selectPre(el) {
    let range = document.createRange();
    range.selectNodeContents(el.target);
    let sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function createPeer() {
    const pid =
      "drawful_" +
      Math.random()
        .toString(36)
        .replace(".", "_");
    peer = new Peer(pid);
    out_url = location.href + "#" + pid;
    peer.on("error", err => console.error(err));

    peer.on("connection", conn => {
      console.log("CONNECTED! with connection:");
      console.log(conn);
      connections.push(conn);
      console.log(users);
      conn.on("data", data => {
        conn.send(
          JSON.stringify({
            type: "old_users",
            users: users
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

  function startGame() {
    for (let conn of connections) {
      conn.send(JSON.stringify({ type: "start_game" }));
    }
  }

  onMount(async () => {
    peer = createPeer();
  });
</script>

<svelte:head>
  <title>WebRTCRelayServer</title>
</svelte:head>

<h1 class="title has-text-centered">Drawful server</h1>

<!-- <pre on:click={selectPre}>{out_url}</pre> -->
<a href={out_url}>{out_url}</a>

<p>Logged users:</p>
<ul>
  {#each users as user}
    <li>{user}</li>
  {/each}
</ul>

<button class="button" on:click|once={startGame} disabled={users.length < 2}>
  Everybody in!
</button>
