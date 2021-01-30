<script lang="ts">
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  let username = "";

  interface User {
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    id?: string;
  }

  const default_images = [
    "https://a.thumbs.redditmedia.com/kIpBoUR8zJLMQlF8azhN-kSBsjVUidHjvZNLuHDONm8.png",
    "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png",
    "https://styles.redditmedia.com/t5_2qhr7/styles/communityIcon_zqe9mgigjpi01.png",
    "https://avatars1.githubusercontent.com/u/6978200",
    "https://avatars2.githubusercontent.com/u/1506147",
  ];

  let img_src = default_images[Math.floor(Math.random() * 5)];

  function onTelegramAuth(user: User) {
    username = user.username || user.first_name + " " + user.last_name;
    img_src = user.photo_url || img_src;
    console.log(
      "Logged in as " +
        user.first_name +
        " " +
        user.last_name +
        " (" +
        user.id +
        (user.username ? ", @" + user.username : "") +
        ")"
    );
    console.log("Image src: " + img_src);
    dispatch("login", {
      username: username,
      img_src: img_src,
    });
  }

  function onManualAuth() {
    console.log("dispatching");
    dispatch("login", {
      username: username,
      img_src: img_src,
    });
  }

  onMount(async () => {
    // @ts-ignore: I know I should find a better way, but this works
    window.onTelegramAuth = onTelegramAuth;
  });
</script>

<pre>No telegram fallback, please don't use this</pre>
<div class="columns">
  <div class="field column">
    <label for="username-input" class="label">Username</label>
    <div class="control">
      <input
        id="username-input"
        bind:value={username}
        class="input"
        type="text"
        placeholder="username"
        required
      />
    </div>
  </div>

  <div class="field column">
    <label for="image-url-input" class="label">Image url</label>
    <div class="control">
      <input
        id="image-url-input"
        bind:value={img_src}
        class="input"
        type="url"
        required
      />
    </div>
  </div>
  <div class="field column is-narrow">
    <label for="login-button" class="label">&nbsp</label>
    <div class="control">
      <button id="login-button" on:click={onManualAuth} class="button is-link"
        >Login</button
      >
    </div>
  </div>
</div>
