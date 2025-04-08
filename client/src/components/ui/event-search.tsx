import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_CATEGORIES, EVENT_DATE_FILTERS, EVENT_PRICE_FILTERS, EVENT_TYPES } from "@shared/schema";
import { 
  Search, 
  SlidersIcon, 
  CalendarIcon, 
  MapPinIcon, 
  TagIcon, 
  ArrowDownAZ, 
  ArrowUpAZ, 
  XCircle, 
  FilterIcon, 
  Ticket, 
  Star,
  X
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";

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
    eventType?: string;
    featured?: boolean;
  }) => void;
}

const EventSearch = ({ onSearch }: EventSearchProps) => {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useState({
    search: "",
    category: "",
    dateFilter: "",
    priceFilter: "",
    minDate: "",
    maxDate: "",
    location: "",
    sortBy: "date-desc", // Default sort
    eventType: "",
    featured: false
  });

  const [minDate, setMinDate] = useState<Date | undefined>(undefined);
  const [maxDate, setMaxDate] = useState<Date | undefined>(undefined);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [activeFilterCount, setActiveFilterCount] = useState(0);
  
  // Count active filters for the filter badge
  useEffect(() => {
    let count = 0;
    if (searchParams.category) count++;
    if (searchParams.dateFilter) count++;
    if (searchParams.priceFilter) count++;
    if (searchParams.minDate || searchParams.maxDate) count++;
    if (searchParams.location) count++;
    if (searchParams.eventType) count++;
    if (searchParams.featured) count++;
    setActiveFilterCount(count);
  }, [searchParams]);

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
  
  const handleEventTypeChange = (value: string) => {
    setSearchParams({
      ...searchParams,
      eventType: value === "all-types" ? "" : value,
    });
  };
  
  const handleFeaturedChange = (value: boolean) => {
    setSearchParams({
      ...searchParams,
      featured: value,
    });
  };
  
  const handleClearFilters = () => {
    setMinDate(undefined);
    setMaxDate(undefined);
    setSearchParams({
      search: searchParams.search, // Keep search term
      category: "",
      dateFilter: "",
      priceFilter: "",
      minDate: "",
      maxDate: "",
      location: "",
      sortBy: "date-desc",
      eventType: "",
      featured: false
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchParams);
  };
  
  // Helper to format filter labels
  const getFilterLabels = () => {
    const filters = [];
    
    if (searchParams.category) {
      filters.push({
        label: searchParams.category,
        key: 'category',
        icon: <TagIcon className="h-3 w-3 mr-1" />
      });
    }
    
    if (searchParams.dateFilter) {
      const dateLabel = searchParams.dateFilter.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      filters.push({
        label: dateLabel,
        key: 'dateFilter',
        icon: <CalendarIcon className="h-3 w-3 mr-1" />
      });
    }
    
    if (searchParams.priceFilter) {
      const priceLabels: Record<string, string> = {
        'free': 'Free',
        'under-25': 'Under $25',
        '25-to-50': '$25 to $50',
        '50-to-100': '$50 to $100',
        'over-100': 'Over $100'
      };
      
      filters.push({
        label: priceLabels[searchParams.priceFilter] || searchParams.priceFilter,
        key: 'priceFilter',
        icon: <TagIcon className="h-3 w-3 mr-1" />
      });
    }
    
    if (searchParams.minDate && searchParams.maxDate) {
      filters.push({
        label: `${format(new Date(searchParams.minDate), 'MMM d')} - ${format(new Date(searchParams.maxDate), 'MMM d')}`,
        key: 'dateRange',
        icon: <CalendarIcon className="h-3 w-3 mr-1" />
      });
    } else if (searchParams.minDate) {
      filters.push({
        label: `From ${format(new Date(searchParams.minDate), 'MMM d')}`,
        key: 'minDate',
        icon: <CalendarIcon className="h-3 w-3 mr-1" />
      });
    } else if (searchParams.maxDate) {
      filters.push({
        label: `Until ${format(new Date(searchParams.maxDate), 'MMM d')}`,
        key: 'maxDate',
        icon: <CalendarIcon className="h-3 w-3 mr-1" />
      });
    }
    
    if (searchParams.location) {
      filters.push({
        label: searchParams.location,
        key: 'location',
        icon: <MapPinIcon className="h-3 w-3 mr-1" />
      });
    }
    
    if (searchParams.eventType) {
      filters.push({
        label: searchParams.eventType.charAt(0).toUpperCase() + searchParams.eventType.slice(1),
        key: 'eventType',
        icon: <Ticket className="h-3 w-3 mr-1" />
      });
    }
    
    if (searchParams.featured) {
      filters.push({
        label: 'Featured',
        key: 'featured',
        icon: <Star className="h-3 w-3 mr-1" />
      });
    }
    
    return filters;
  };

  const SearchContent = () => (
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

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {getFilterLabels().map((filter) => (
            <Badge 
              key={filter.key} 
              variant="secondary"
              className="py-1 px-2 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <span className="flex items-center">
                {filter.icon}
                {filter.label}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-1 text-gray-500 hover:text-gray-800"
                onClick={() => {
                  if (filter.key === 'dateRange' || filter.key === 'minDate' || filter.key === 'maxDate') {
                    handleClearDates();
                  } else if (filter.key === 'category') {
                    handleCategoryChange('all-categories');
                  } else if (filter.key === 'dateFilter') {
                    handleDateFilterChange('all');
                  } else if (filter.key === 'priceFilter') {
                    handlePriceFilterChange('all');
                  } else if (filter.key === 'eventType') {
                    handleEventTypeChange('all-types');
                  } else if (filter.key === 'featured') {
                    handleFeaturedChange(false);
                  } else if (filter.key === 'location') {
                    setSearchParams({
                      ...searchParams,
                      location: ''
                    });
                  }
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          
          {activeFilterCount > 1 && (
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              className="text-xs text-gray-600 hover:text-gray-900"
              onClick={handleClearFilters}
            >
              Clear All Filters
            </Button>
          )}
        </div>
      )}
      
      {isMobile ? (
        <Drawer>
          <DrawerTrigger asChild>
            <Button 
              type="button" 
              variant="outline" 
              className="text-gray-600 w-full flex items-center justify-center"
            >
              Filters
              <FilterIcon className="ml-2 h-4 w-4" />
              {activeFilterCount > 0 && (
                <Badge className="ml-2 text-xs" variant="secondary">{activeFilterCount}</Badge>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="px-4 py-5 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Filter Events</h3>
              {/* Mobile Filters Content */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-2">Event Type</h4>
                  <Select
                    value={searchParams.eventType || "all-types"}
                    onValueChange={handleEventTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Event Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-types">All Event Types</SelectItem>
                      {EVENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Price Range</h4>
                  <RadioGroup
                    value={searchParams.priceFilter || "all"}
                    onValueChange={handlePriceFilterChange}
                    className="space-y-2"
                  >
                    <div className="flex items-center">
                      <RadioGroupItem value="all" id="mobile-price-all" />
                      <Label htmlFor="mobile-price-all" className="ml-2">Any Price</Label>
                    </div>
                    <div className="flex items-center">
                      <RadioGroupItem value="free" id="mobile-price-free" />
                      <Label htmlFor="mobile-price-free" className="ml-2">Free</Label>
                    </div>
                    <div className="flex items-center">
                      <RadioGroupItem value="under-25" id="mobile-price-under-25" />
                      <Label htmlFor="mobile-price-under-25" className="ml-2">Under $25</Label>
                    </div>
                    <div className="flex items-center">
                      <RadioGroupItem value="25-to-50" id="mobile-price-25-50" />
                      <Label htmlFor="mobile-price-25-50" className="ml-2">$25 to $50</Label>
                    </div>
                    <div className="flex items-center">
                      <RadioGroupItem value="50-to-100" id="mobile-price-50-100" />
                      <Label htmlFor="mobile-price-50-100" className="ml-2">$50 to $100</Label>
                    </div>
                    <div className="flex items-center">
                      <RadioGroupItem value="over-100" id="mobile-price-over-100" />
                      <Label htmlFor="mobile-price-over-100" className="ml-2">Over $100</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Date</h4>
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
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium mb-2">Date Range</h4>
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
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Location</h4>
                  <Input
                    type="text"
                    name="location"
                    placeholder="Enter a city or venue"
                    value={searchParams.location}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="mobile-featured"
                    checked={searchParams.featured}
                    onChange={(e) => handleFeaturedChange(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="mobile-featured">Featured Events Only</Label>
                </div>
                
                <div className="pt-4 space-y-2">
                  <Button 
                    type="submit" 
                    className="w-full"
                  >
                    Apply Filters
                  </Button>
                  
                  {activeFilterCount > 0 && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleClearFilters}
                    >
                      Clear All Filters
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <>
          {/* Advanced filters toggle for desktop */}
          <div className="flex gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              className="text-gray-600"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            >
              {isAdvancedOpen ? 'Hide' : 'Show'} Advanced Filters
              <SlidersIcon className="ml-2 h-4 w-4" />
              {!isAdvancedOpen && activeFilterCount > 0 && (
                <Badge className="ml-2 text-xs" variant="secondary">{activeFilterCount}</Badge>
              )}
            </Button>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="featured"
                checked={searchParams.featured}
                onChange={(e) => handleFeaturedChange(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="featured">Featured Events Only</Label>
            </div>
          </div>
        </>
      )}
      
      {/* Advanced filters section for desktop */}
      {!isMobile && isAdvancedOpen && (
        <div className="bg-gray-50 p-4 rounded-md mt-4 grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Event Type Filter */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Ticket className="h-4 w-4 mr-1" />
              Event Type
            </h3>
            <Select
              value={searchParams.eventType || "all-types"}
              onValueChange={handleEventTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Event Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-types">All Event Types</SelectItem>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        
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
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-poppins text-gray-900 mb-6">
          Find Your Next Experience
        </h1>
        <SearchContent />
      </div>
    </div>
  );
};

export default EventSearch;
