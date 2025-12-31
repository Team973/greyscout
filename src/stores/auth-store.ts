// TODO: fix types
// @ts-nocheck

import { defineStore } from "pinia";


import { supabase } from "@/lib/supabase-client";

export const useAuthStore = defineStore('auth', {
    state() {
        return {
            isLoggedIn: false,
            isUpdated: false
        }
    },
    getters: {
        isAuthorized(): String {
            return this.isLoggedIn;
        },
        isLoaded(): boolean {
            return this.isUpdated;
        }
    },
    actions: {
        async checkUser() {
            this.isUpdated = false;
            const { data: { user }, error } = await supabase.auth.getUser();

            this.isLoggedIn = !error;
            this.isUpdated = true;
        }
    }
});
