<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import "@material/web/button/filled-button";
import TextInput from '@/components/TextInput.vue';

import { supabase } from "@/lib/supabase-client";

import { useAuthStore } from "@/stores/auth-store";
</script>

<template>
    <div class="main-content">
        <div>
            <TextInput :model-value="userEmail" @update:modelValue="updateEmail" label="Email" required="true"
                :error="emailError">
            </TextInput>
        </div>
        <div>
            <TextInput :model-value="userPassword" @update:modelValue="updatePassword" label="Password" required="true"
                :error="passwordError" type="password">
            </TextInput>
        </div>
        <div>
            <md-filled-button v-on:click="logInUser()" class="load-button">Log in</md-filled-button>
        </div>
    </div>
</template>

<script lang="ts">
export default {
    data() {
        return {
            userEmail: "",
            userPassword: "",
            emailError: false,
            passwordError: false,
            authStore: null,
        }
    },
    methods: {
        updateEmail(text) {
            this.userEmail = text;
            this.emailError = (this.userEmail == "");
        },
        updatePassword(text) {
            this.userPassword = text;
            this.passwordError = (this.userPassword == "");
        },
        async logInUser() {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: this.userEmail,
                password: this.userPassword,
            });

            if (error) {
                // TODO
                return;
            }

            this.authStore.checkUser();
            this.$router.push("/event");
        }
    },
    created() {
        this.authStore = useAuthStore();
    }
}
</script>

<style scoped></style>