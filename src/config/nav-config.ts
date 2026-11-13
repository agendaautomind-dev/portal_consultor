import { NavGroup } from '@/types';

export const navGroups: NavGroup[] = [
  {
    label: 'Meu desempenho',
    items: [
      {
        title: 'Visão geral',
        url: '/dashboard/overview',
        icon: 'dashboard',
        shortcut: ['d', 'd'],
        items: []
      },
      {
        title: 'Minhas vendas',
        url: '/dashboard/sales',
        icon: 'product',
        shortcut: ['v', 'v'],
        items: []
      },
      {
        title: 'Comissões',
        url: '/dashboard/commissions',
        icon: 'billing',
        shortcut: ['c', 'c'],
        items: []
      },
      {
        title: 'Inadimplência',
        url: '/dashboard/delinquency',
        icon: 'warning',
        shortcut: ['i', 'i'],
        items: []
      },
      {
        title: 'Metas',
        url: '/dashboard/goals',
        icon: 'badgeCheck',
        shortcut: ['m', 'm'],
        items: []
      }
    ]
  },
  {
    label: 'Conta',
    items: [
      { title: 'Meu perfil', url: '/dashboard/profile', icon: 'profile', items: [] },
      { title: 'Notificações', url: '/dashboard/notifications', icon: 'notification', items: [] }
    ]
  }
];
