// TODO: fix types
// @ts-nocheck

import { defineStore } from "pinia";

import { supabase } from "@/lib/supabase-client";
import { userTable, isSiteReadPrivate, isSiteWritePrivate } from "@/lib/constants";

export const useAuthStore = defineStore('auth', {
    state() {
        return {
            isLoggedIn: false,
            userAuthLevel: {
                canWrite: false,
            },
            isUpdated: false
        }
    },
    getters: {
        isUserLoggedIn(): boolean {
            return this.isLoggedIn;
        },
        isViewAuthorized(): boolean {
            return this.isLoggedIn || !isSiteReadPrivate;
        },
        isWriteAuthorized(): boolean {
            return (this.isLoggedIn && this.userAuthLevel.canWrite) || !isSiteWritePrivate;
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

            if (error || !user) {
                this.userAuthLevel.canWrite = false;
                return;
            }

            const userId = user.id;
            const dbResponse = await supabase.from(userTable).select().eq("user_id", userId);

            const dbData = dbResponse?.data;
            const dbError = dbResponse?.error;
            if (dbError || !dbData || dbData?.length == 0) {
                this.userAuthLevel.canWrite = false;
                return;
            }
            this.userAuthLevel.canWrite = dbData[0].write_authorized;

            this.isUpdated = true;
        }
    }
});
