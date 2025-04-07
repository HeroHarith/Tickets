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
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
                aria-current={activeTab === tab.id ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <div>
            <Link href="/create-event">
              <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                Create Event
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TabsComponent;