import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_CATEGORIES } from "@shared/schema";
import { Search } from "lucide-react";

interface EventSearchProps {
  onSearch: (params: {
    search: string;
    category: string;
    date: string;
  }) => void;
}

const EventSearch = ({ onSearch }: EventSearchProps) => {
  const [searchParams, setSearchParams] = useState({
    search: "",
    category: "",
    date: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setSearchParams({
      ...searchParams,
      [e.target.name]: e.target.value,
    });
  };

  const handleCategoryChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      category: value === "all-categories" ? "" : value,
    });
  };

  const handleDateChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      date: value === "all-dates" ? "" : value,
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchParams);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-poppins text-gray-900 mb-6">
          Find Your Next Experience
        </h1>
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow">
            <Input
              type="text"
              name="search"
              placeholder="Search for events..."
              value={searchParams.search}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary"
            />
          </div>
          <div className="w-full md:w-48">
            <Select
              value={searchParams.category || "all-categories"}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-categories">All Categories</SelectItem>
                {EVENT_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-48">
            <Select
              value={searchParams.date || "all-dates"}
              onValueChange={handleDateChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Dates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-dates">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="future">Future Events</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button
              type="submit"
              className="w-full md:w-auto bg-primary text-white hover:bg-primary/90"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventSearch;
