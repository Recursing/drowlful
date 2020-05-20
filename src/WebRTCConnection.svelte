<script>
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let username;
  export let img_src;

  let connection;

  export function sendObject(obj) {
    obj.username = username;
    connection.send(JSON.stringify(obj));
  }

  function selectPre(event) {
    let range = document.createRange();
    range.selectNodeContents(event.target);
    let sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function initConnection(pid) {
    const uid =
      "drawfulPlayer_" +
      Math.random()
        .toString(36)
        .replace(".", "_");
    const peer = new Peer(uid);
    peer.on("error", err => console.error(err));

    peer.on("connection", conn => {
      console.log("CONNECTED!");
      console.log(conn);
      // connection = conn;
    });
    connection = peer.connect(pid);
    connection.on("open", () => {
      connection.on("data", data => {
        console.log("got data:", data);
        dispatch("onMessage", JSON.parse(data));
      });
      sendObject({
        type: "new_user",
        username: username,
        img_src: img_src
      });
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
