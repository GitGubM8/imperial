<template>
  <div>
    <div v-for="(error, index) in errors" v-bind:key="index">
      {{ error }}
    </div>
    <form class="flex flex-col mx-auto rounded bg-green-200 sm:max-w-4xl mt-10 sm:p-20" @submit="signIn">
      <input
        type="text"
        placeholder="email"
        v-model="email"
        class="rounded p-5 border border-green-800 my-2 sm:w-1/2 self-center"
      />
      <input
        type="password"
        placeholder="password"
        v-model="password"
        class="rounded p-5 border border-green-800 my-2 sm:w-1/2 self-center"
      />
      <input
        type="submit"
        value="Sign In"
        class="rounded p-5 bg-green-800 text-white cursor-pointer my-2 text-2xl sm:w-1/2 self-center"
      />
      <router-link to="/forgot_password" class="self-center">
        <p class="underline">Forgot your password?</p>
      </router-link>
    </form>
  </div>
</template>

<script>
export default {
  name: "SignIn",
  props: ["profile"],
  data: function () {
    return {
      email: "",
      errors: [],
      password: ""
    }
  },
  created() {
    document.title = "Sign In - Imperial";
  },
  methods: {
    signIn: function(e) {
      fetch("/accounts/sign_in", {
        method: "POST",
        headers: {
          "X-CSRF-Token": this.$cookies.get("CSRF-TOKEN"),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: this.email, password: this.password })
      })
        .then(response => response.json())
        .then(data => {
          if (data.email) {
            this.$emit("signedIn", { username: data.username, email: data.email });
            this.errors = [];
            this.$router.push("/");
          } else {
            this.errors = data;
          }
        })
      e.preventDefault();
    }
  }
}
</script>
