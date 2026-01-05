import {createRouter, createWebHistory, RouteRecordRaw} from 'vue-router';
import Summary from '../views/Summary.vue';
import Logs from '../views/Logs.vue';
import Metrics from '../views/Metrics.vue';
import Traces from '../views/Traces.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Summary',
    component: Summary,
  },
  {
    path: '/logs',
    name: 'Logs',
    component: Logs,
  },
  {
    path: '/metrics',
    name: 'Metrics',
    component: Metrics,
  },
  {
    path: '/traces',
    name: 'Traces',
    component: Traces,
  },
  {
    path: '/traces/:traceId',
    name: 'TraceDetails',
    component: () => import('../views/TraceDetails.vue'),
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
