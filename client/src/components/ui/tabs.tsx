import { Link } from "wouter";

interface Tab {
  id: string;
  label: string;
  href: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
}

const Tabs = ({ tabs, activeTab }: TabsProps) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } px-1 py-4 border-b-2 font-medium text-sm`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Tabs;
