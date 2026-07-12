import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '../styles/desktop.scss'
import QuickCaptureApp from './QuickCaptureApp.vue'
import './capture.scss'

createApp(QuickCaptureApp).use(ElementPlus).mount('#capture-app')
