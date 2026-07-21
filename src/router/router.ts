// TODO: fix types
// @ts-nocheck

import { isSiteReadPrivate, isSiteWritePrivate } from "@/lib/constants";

import { createRouter, createWebHistory } from "vue-router";
import DataUploadView from "@/views/DataUploadView.vue";
import MatchScoutView from "@/views/MatchScoutView.vue";
import PitScoutView from "@/views/PitScoutView.vue";
import TeamAnalysisView from "@/views/TeamAnalysisView.vue";
import EventAnalysisView from "@/views/EventAnalysisView.vue";
import MatchPreviewView from "@/views/MatchPreviewView.vue";
import CustomDataVisualizationView from "@/views/CustomDataVisualizationView.vue";
import LoginView from "@/views/LoginView.vue";
import RegisterView from "@/views/RegisterView.vue";
import ResetPasswordView from "@/views/ResetPasswordView.vue";
import AccountView from "@/views/AccountView.vue";
import PicklistView from "@/views/PicklistView.vue";
import { useAuthStore } from "@/stores/auth-store";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "Home | GreyScout",
      component: LoginView
    },
    {
      path: "/upload",
      name: "Data Upload | GreyScout",
      component: DataUploadView,
      meta: {
        requiresAuth: isSiteWritePrivate
      }
    },
    {
      path: "/event",
      name: "Event Analysis | GreyScout",
      component: EventAnalysisView,
      meta: {
        requiresAuth: isSiteReadPrivate
      }
    },
    {
      path: "/match",
      name: "Match Scouting | GreyScout",
      component: MatchScoutView,
      meta: {
        requiresAuth: isSiteReadPrivate
      }
    },
    {
      path: "/pit",
      name: "Pit Scouting | GreyScout",
      component: PitScoutView,
      meta: {
        requiresAuth: isSiteReadPrivate
      }
    },
    {
      path: "/team",
      name: "Team Analysis | GreyScout",
      component: TeamAnalysisView,
      meta: {
        requiresAuth: isSiteReadPrivate
      }
    },
    {
      path: "/event",
      name: "Event Analysis | GreyScout",
      component: EventAnalysisView,
      meta: {
        requiresAuth: isSiteReadPrivate
      }
    },
    {
      path: "/match",
      name: "Match Preview | GreyScout",
      component: MatchPreviewView,
      meta: {
        requiresAuth: isSiteReadPrivate
      }
    },
    {
      path: "/chartbuilder",
      name: "Chart Builder | GreyScout",
      component: CustomDataVisualizationView,
      meta: {
        requiresAuth: isSiteReadPrivate
      }
    },
    {
      path: "/login",
      name: "Login | GreyScout",
      component: LoginView,
    },
    {
      path: "/register",
      name: "Register | GreyScout",
      component: RegisterView,
    },
    {
      path: "/reset-password",
      name: "Reset Password | GreyScout",
      component: ResetPasswordView,
    },
    {
      path: "/account",
      name: "Account | GreyScout",
      component: AccountView,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/picklist",
      name: "Pick List | GreyScout",
      component: PicklistView,
      meta: {
        requiresAuth: isSiteReadPrivate
      }
    }
  ],
});

router.beforeEach(async (to, from, next) => {
  // Prevent unauthorized users from accessing the app if the app is private.
  if (isSiteReadPrivate) {
    let authStore = useAuthStore();
    await authStore.checkUser();
    if (to.meta.requiresAuth && !authStore.isUserLoggedIn) {
      next('/login');
    } else {
      document.title = to.name;
      next();
    }
  } else {
    document.title = to.name;
    next();
  }


});

export default router;
