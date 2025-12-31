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
        <div class="user-tile">
            <h1>Access</h1>
            <div>
                Can Write: {{ authStore.isWriteAuthorized }}
            </div>
        </div>

        <div class="user-tile">
            <h1>Log Out</h1>
            <md-filled-button v-on:click="logOutUser()" class="load-button">Log out</md-filled-button>
        </div>
    </div>
</template>

<script lang="ts">
export default {
    data() {
        return {
            authStore: null,
        }
    },
    methods: {
        async logOutUser() {
            const { error } = await supabase.auth.signOut();

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