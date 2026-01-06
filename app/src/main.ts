import {createApp, defineAsyncComponent} from "vue";
import App from "./App.vue";
import router from "./router";
import PrimeVue from 'primevue/config';
import {createPinia} from "pinia";
// import Button from "primevue/button";
// import DataTable from "primevue/datatable";
// import TreeTable from "primevue/treetable";
import Column from "primevue/column";
// import Select from "primevue/select";
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css';
import './styles/variables.css';
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
app.component('Button', defineAsyncComponent(() => import('primevue/button')));
app.component('DataTable', defineAsyncComponent(() => import('primevue/datatable')));
app.component('TreeTable', defineAsyncComponent(() => import('primevue/treetable')));
app.component('Column', Column);
app.component('Select', defineAsyncComponent(() => import('primevue/select')));
app.component('Chart', defineAsyncComponent(() => import('primevue/chart')));
app.component('SelectButton', defineAsyncComponent(() => import('primevue/selectbutton')));
app.mount("#app");
