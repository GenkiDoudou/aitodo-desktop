import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import WidgetApp from './WidgetApp.vue'
import './widget.scss'

createApp(WidgetApp).use(ElementPlus).mount('#widget-app')
