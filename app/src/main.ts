import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import PrimeVue from 'primevue/config';
import {createPinia} from "pinia";
import Button from "primevue/button";
import DataTable from "primevue/datatable";
import TreeTable from "primevue/treetable";
import Column from "primevue/column";
import Select from "primevue/select";
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';
import './styles/details-table.css';
import './styles/page.css';
import './styles/list-table.css';


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
app.component('Button', Button);
app.component('DataTable', DataTable);
app.component('TreeTable', TreeTable);
app.component('Column', Column);
app.component('Select', Select);
app.mount("#app");
