import { NavigationItem } from '../types';

export const navigationItems: NavigationItem[] = [
  {
    name: 'Home',
    path: '/app/home',
    icon: 'home',
    mobile: true,
  },
  {
    name: 'Contacts',
    path: '/app/contacts',
    icon: 'book',
    mobile: true,
  },
  {
    name: 'Lead IQ',
    path: '/app/sales',
    icon: 'zap',
    mobile: true,
  },
  {
    name: 'Contracts',
    path: '/app/contracts',
    icon: 'fileText',
    mobile: true,
  },
  {
    name: 'Letters',
    path: '/app/samples',
    icon: 'bookmark',
    mobile: true,
  },
  {
    name: 'Payments',
    path: '/app/debit-notes',
    icon: 'receipt',
    mobile: true,
  },
  {
    name: 'Emails',
    path: '/app/email-templates',
    icon: 'mail',
    mobile: false,
  },
  {
    name: 'Data',
    path: '/app/settings',
    icon: 'database',
    mobile: false,
  }
];