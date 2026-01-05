import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';
import './styles/details-table.css';
import './styles/page.css';
import './styles/list-table.css';
import {createPinia} from "pinia";

const app = createApp(App);
app.use(router);
app.use(createPinia());
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
        }
    }
});
app.mount("#app");
