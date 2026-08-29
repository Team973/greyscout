// TODO: fix types
// @ts-nocheck

import { isSiteReadPrivate, isSiteWritePrivate } from "@/lib/constants";

import { createRouter, createWebHistory } from "vue-router";
import DataUploadView from "@/views/DataUploadView.vue";
import MatchScoutView from "@/views/MatchScoutView.vue";
import PitScoutingView from "@/views/PitScoutingView.vue";
import TeamAnalysisView from "@/views/TeamAnalysisView.vue";
import EventAnalysisView from "@/views/EventAnalysisView.vue";
import StrategyView from "@/views/StrategyView.vue";
import CustomDataVisualizationView from "@/views/CustomDataVisualizationView.vue";
import LoginView from "@/views/LoginView.vue";
import RegisterView from "@/views/RegisterView.vue";
import ResetPasswordView from "@/views/ResetPasswordView.vue";
import AccountView from "@/views/AccountView.vue";
import PicklistView from "@/views/PicklistView.vue";
import DataStatusView from "@/views/DataStatusView.vue";
import ScoutScheduleView from "@/views/ScoutScheduleView.vue";
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
      path: "/team",
      name: "Team Analysis | GreyScout",
      component: TeamAnalysisView,
      meta: {
        requiresAuth: isSiteReadPrivate
      }
    },
    {
      path: "/pit",
      name: "Pit Scouting | GreyScout",
      component: PitScoutingView,
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
      path: "/strategy",
      name: "Strategy | GreyScout",
      component: StrategyView,
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
    },
    {
      path: "/data-status",
      name: "Data Status | GreyScout",
      component: DataStatusView,
      meta: {
        requiresAuth: isSiteReadPrivate
      }
    },
    {
      path: "/schedule",
      name: "Schedule | GreyScout",
      component: ScoutScheduleView,
      meta: {
        requiresAuth: isSiteReadPrivate
      }
    }
  ],
});

router.beforeEach(async (to, from, next) => {
  let authStore = useAuthStore();

  // Prevent unauthorized users from accessing the app if the app is private.
  if (isSiteReadPrivate) {
    await authStore.checkUser();
  }

  if (isSiteReadPrivate && to.meta.requiresAuth && !authStore.isUserLoggedIn) {
    next('/login');
    return;
  }

  document.title = to.name;
  next();
});

export default router;
