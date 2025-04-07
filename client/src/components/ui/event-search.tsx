import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_CATEGORIES, EVENT_DATE_FILTERS, EVENT_PRICE_FILTERS } from "@shared/schema";
import { Search, SlidersIcon, CalendarIcon, MapPinIcon, TagIcon, ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface EventSearchProps {
  onSearch: (params: {
    search: string;
    category: string;
    dateFilter?: string;
    priceFilter?: string;
    minDate?: string;
    maxDate?: string;
    location?: string;
    sortBy?: string;
  }) => void;
}

const EventSearch = ({ onSearch }: EventSearchProps) => {
  const [searchParams, setSearchParams] = useState({
    search: "",
    category: "",
    dateFilter: "",
    priceFilter: "",
    minDate: "",
    maxDate: "",
    location: "",
    sortBy: "date-desc" // Default sort
  });

  const [minDate, setMinDate] = useState<Date | undefined>(undefined);
  const [maxDate, setMaxDate] = useState<Date | undefined>(undefined);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

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

  const handleDateFilterChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      dateFilter: value === "all" ? "" : value,
    });
  };

  const handlePriceFilterChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      priceFilter: value === "all" ? "" : value,
    });
  };

  const handleSortByChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      sortBy: value,
    });
  };

  const handleMinDateChange = (date: Date | undefined) => {
    setMinDate(date);
    setSearchParams({
      ...searchParams,
      minDate: date ? date.toISOString() : "",
    });
  };

  const handleMaxDateChange = (date: Date | undefined) => {
    setMaxDate(date);
    setSearchParams({
      ...searchParams,
      maxDate: date ? date.toISOString() : "",
    });
  };

  const handleClearDates = () => {
    setMinDate(undefined);
    setMaxDate(undefined);
    setSearchParams({
      ...searchParams,
      minDate: "",
      maxDate: "",
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
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Basic search row */}
          <div className="flex flex-col md:flex-row gap-4">
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
                value={searchParams.dateFilter || "all"}
                onValueChange={handleDateFilterChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-weekend">This Weekend</SelectItem>
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
          </div>
          
          {/* Advanced filters toggle */}
          <div className="pt-2">
            <Button 
              type="button" 
              variant="outline" 
              className="text-gray-600"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            >
              {isAdvancedOpen ? 'Hide' : 'Show'} Advanced Filters
              <SlidersIcon className="ml-2 h-4 w-4" />
            </Button>
          </div>
          
          {/* Advanced filters section */}
          {isAdvancedOpen && (
            <div className="bg-gray-50 p-4 rounded-md mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Price Filter */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <TagIcon className="h-4 w-4 mr-1" />
                  Price Range
                </h3>
                <RadioGroup
                  value={searchParams.priceFilter || "all"}
                  onValueChange={handlePriceFilterChange}
                  className="space-y-1"
                >
                  <div className="flex items-center">
                    <RadioGroupItem value="all" id="price-all" />
                    <Label htmlFor="price-all" className="ml-2 cursor-pointer">Any Price</Label>
                  </div>
                  <div className="flex items-center">
                    <RadioGroupItem value="free" id="price-free" />
                    <Label htmlFor="price-free" className="ml-2 cursor-pointer">Free</Label>
                  </div>
                  <div className="flex items-center">
                    <RadioGroupItem value="under-25" id="price-under-25" />
                    <Label htmlFor="price-under-25" className="ml-2 cursor-pointer">Under $25</Label>
                  </div>
                  <div className="flex items-center">
                    <RadioGroupItem value="25-to-50" id="price-25-50" />
                    <Label htmlFor="price-25-50" className="ml-2 cursor-pointer">$25 to $50</Label>
                  </div>
                  <div className="flex items-center">
                    <RadioGroupItem value="50-to-100" id="price-50-100" />
                    <Label htmlFor="price-50-100" className="ml-2 cursor-pointer">$50 to $100</Label>
                  </div>
                  <div className="flex items-center">
                    <RadioGroupItem value="over-100" id="price-over-100" />
                    <Label htmlFor="price-over-100" className="ml-2 cursor-pointer">Over $100</Label>
                  </div>
                </RadioGroup>
              </div>
              
              {/* Date Range Picker */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  Date Range
                </h3>
                <div className="space-y-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {minDate ? format(minDate, "PPP") : "Start Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={minDate}
                        onSelect={handleMinDateChange}
                        disabled={(date) => maxDate ? date > maxDate : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {maxDate ? format(maxDate, "PPP") : "End Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={maxDate}
                        onSelect={handleMaxDateChange}
                        disabled={(date) => minDate ? date < minDate : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  
                  {(minDate || maxDate) && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleClearDates}
                      className="text-xs"
                    >
                      Clear Dates
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Location & Sort */}
              <div className="space-y-4">
                {/* Location Search */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <MapPinIcon className="h-4 w-4 mr-1" />
                    Location
                  </h3>
                  <Input
                    type="text"
                    name="location"
                    placeholder="Enter a city or venue"
                    value={searchParams.location}
                    onChange={handleInputChange}
                  />
                </div>
                
                {/* Sort By */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    {searchParams.sortBy?.includes('asc') ? (
                      <ArrowUpAZ className="h-4 w-4 mr-1" />
                    ) : (
                      <ArrowDownAZ className="h-4 w-4 mr-1" />
                    )}
                    Sort By
                  </h3>
                  <Select
                    value={searchParams.sortBy}
                    onValueChange={handleSortByChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Date (Newest First)</SelectItem>
                      <SelectItem value="date-asc">Date (Oldest First)</SelectItem>
                      <SelectItem value="price-asc">Price (Low to High)</SelectItem>
                      <SelectItem value="price-desc">Price (High to Low)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default EventSearch;
