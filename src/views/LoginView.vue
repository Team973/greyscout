<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import "@material/web/button/filled-button";
import "@material/web/button/text-button";
import TextInput from '@/components/TextInput.vue';
import { RouterLink } from 'vue-router';

import { supabase } from "@/lib/supabase-client";

import { useAuthStore } from "@/stores/auth-store";
</script>

<template>
    <div class="main-content">
        <div class="login-tile" v-if="!showForgotPassword">
            <h1 class="login-tile-element">Log in</h1>
            <div class="login-tile-element">
                <TextInput :model-value="userEmail" @update:modelValue="updateEmail" label="Email" required="true"
                    :error="emailError">
                </TextInput>
            </div>
            <div class="login-tile-element">
                <TextInput :model-value="userPassword" @update:modelValue="updatePassword" @keyup.enter="logInUser"
                    label="Password" required="true" :error="passwordError" type="password">
                </TextInput>
            </div>
            <div class="login-tile-element" v-if="formError">
                <p class="form-error">{{ formError }}</p>
            </div>
            <div class="login-tile-element">
                <md-filled-button v-on:click="logInUser()" class="load-button">Log in</md-filled-button>
            </div>
            <div class="login-tile-element">
                <md-text-button v-on:click="showForgotPassword = true">Forgot password?</md-text-button>
            </div>
            <div class="login-tile-element">
                <RouterLink to="/register">Need an account? Register</RouterLink>
            </div>
        </div>

        <div class="login-tile" v-else>
            <h1 class="login-tile-element">Reset password</h1>
            <div class="login-tile-element">
                <TextInput :model-value="resetEmail" @update:modelValue="updateResetEmail" @keyup.enter="sendPasswordReset"
                    label="Email" required="true" :error="resetEmailError">
                </TextInput>
            </div>
            <div class="login-tile-element" v-if="resetError">
                <p class="form-error">{{ resetError }}</p>
            </div>
            <div class="login-tile-element" v-if="resetSuccess">
                <p class="form-success">{{ resetSuccess }}</p>
            </div>
            <div class="login-tile-element">
                <md-filled-button v-on:click="sendPasswordReset()" class="load-button">Send reset
                    email</md-filled-button>
            </div>
            <div class="login-tile-element">
                <md-text-button v-on:click="showForgotPassword = false">Back to log in</md-text-button>
            </div>
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
            formError: "",
            showForgotPassword: false,
            resetEmail: "",
            resetEmailError: false,
            resetError: "",
            resetSuccess: "",
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
        updateResetEmail(text) {
            this.resetEmail = text;
            this.resetEmailError = (this.resetEmail == "");
        },
        async logInUser() {
            this.formError = "";
            this.emailError = (this.userEmail == "");
            this.passwordError = (this.userPassword == "");
            if (this.emailError || this.passwordError) {
                return;
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: this.userEmail,
                password: this.userPassword,
            });

            if (error) {
                this.formError = error.message;
                return;
            }

            this.authStore.checkUser();
            this.$router.push("/picklist");
        },
        async sendPasswordReset() {
            this.resetError = "";
            this.resetSuccess = "";
            this.resetEmailError = (this.resetEmail == "");
            if (this.resetEmailError) {
                return;
            }

            const { error } = await supabase.auth.resetPasswordForEmail(this.resetEmail, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (error) {
                this.resetError = error.message;
                return;
            }

            this.resetSuccess = "If that email is in our system, a reset link has been sent.";
        }
    },
    created() {
        this.authStore = useAuthStore();
    }
}
</script>

<style scoped>
.login-tile-element {
    padding: 15px;
}

.form-error {
    color: #c0392b;
    margin: 0;
}

.form-success {
    color: #3a9e3a;
    margin: 0;
}
</style>