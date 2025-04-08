import { Link } from "wouter";

interface TabItem {
  id: string;
  label: string;
  href: string;
}

interface TabsComponentProps {
  tabs: TabItem[];
  activeTab: string;
}

const TabsComponent = ({ tabs, activeTab }: TabsComponentProps) => {
  // Returning an empty fragment to avoid rendering the duplicate navigation
  return null;
};

export default TabsComponent;