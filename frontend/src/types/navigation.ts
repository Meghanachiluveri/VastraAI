export interface NavItem {
  label: string;
  href: string;
  badge?: string;
  isAccent?: boolean;
}

export interface FooterSection {
  title: string;
  links: Array<{
    label: string;
    href: string;
    isExternal?: boolean;
  }>;
}
