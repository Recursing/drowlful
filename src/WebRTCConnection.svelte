<script lang="ts">
  import Peer from "peerjs";
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let username: string;
  export let img_src: string;

  let connection: Peer.DataConnection;

  export const sendObject = (obj: any) => {
    obj.username = username;
    connection.send(JSON.stringify(obj));
  };

  function initConnection(pid: string) {
    const peer = new Peer();
    peer.on("open", () => {
      console.log("Peer opened, connecting to:", pid);
      connection = peer.connect(pid);
      connection.on("open", () => {
        connection.on("data", (data) => {
          console.log("got data:", data);
          dispatch("onMessage", JSON.parse(data));
        });
        sendObject({
          type: "new_user",
          username: username,
          img_src: img_src,
        });
      });
    });
    peer.on("error", (err) => console.error(err));

    peer.on("connection", (conn) => {
      console.log("CONNECTED!");
      console.log(conn);
      // connection = conn;
    });
  }

  onMount(async () => {
    const pid = location.hash.slice(1);
    console.log("connecting to " + pid);
    initConnection(pid);
  });
</script>

<p>
  Establishing connection... If I don't disappear after a while reload this page
</p>
