import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import SettingsView from '@/views/SettingsView.vue'

/** Hash 路由避免 file:// 协议下 history 模式问题 */
export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/settings', name: 'settings', component: SettingsView }
  ]
})
