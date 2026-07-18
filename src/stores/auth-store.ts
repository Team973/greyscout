// @ts-nocheck

import { defineStore } from 'pinia';
import { supabase } from '@/lib/supabase-client';
import { userTable } from '@/lib/constants';
import { isSiteReadPrivate, isSiteWritePrivate } from '@/lib/constants';

export type UserRole = 'admin' | 'lead' | 'member' | null;

export const useAuthStore = defineStore('auth', {
    state() {
        return {
            isLoggedIn: false,
            userId: null as string | null,
            userAuthLevel: {
                canWrite: false,
            },
            role: null as UserRole,
            isUpdated: false
        };
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
        },
        // Role-based getters
        isAdmin(): boolean {
            return this.role === 'admin';
        },
        isLead(): boolean {
            return this.role === 'admin' || this.role === 'lead';
        },
        isMember(): boolean {
            return this.isLoggedIn;
        },
        currentUserId(): string | null {
            return this.userId;
        }
    },
    actions: {
        async checkUser() {
            this.isUpdated = false;

            const { data: { user }, error } = await supabase.auth.getUser();
            this.isLoggedIn = !error && !!user;

            if (error || !user) {
                this.userAuthLevel.canWrite = false;
                this.role = null;
                this.userId = null;
                this.isUpdated = true;
                return;
            }

            this.userId = user.id;

            const dbResponse = await supabase
                .from(userTable)
                .select()
                .eq('user_id', user.id);

            const dbData = dbResponse?.data;
            const dbError = dbResponse?.error;

            if (dbError || !dbData || dbData?.length === 0) {
                this.userAuthLevel.canWrite = false;
                this.role = 'member';
                this.isUpdated = true;
                return;
            }

            this.userAuthLevel.canWrite = dbData[0].write_authorized;

            // Determine role — use 'role' column if present, otherwise derive from write_authorized.
            if (dbData[0].role) {
                this.role = dbData[0].role as UserRole;
            } else if (dbData[0].write_authorized) {
                this.role = 'lead';
            } else {
                this.role = 'member';
            }

            this.isUpdated = true;
        }
    }
});
