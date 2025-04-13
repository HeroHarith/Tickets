import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVENT_CATEGORIES, EVENT_DATE_FILTERS, EVENT_PRICE_FILTERS, EVENT_TYPES } from "@shared/schema";
import { debounce, throttle } from "@/utils/performance";
import { 
  Search, 
  SlidersIcon, 
  CalendarIcon, 
  MapPinIcon, 
  TagIcon, 
  ArrowDownAZ, 
  ArrowUpAZ, 
  XIcon, 
  ArrowDown01, 
  ArrowUp01 
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

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
  initialValues?: {
    search?: string;
    category?: string;
    dateFilter?: string;
    priceFilter?: string;
    minDate?: string;
    maxDate?: string;
    location?: string;
    sortBy?: string;
    eventType?: string;
    featured?: boolean;
  };
}

export function EventSearch({ onSearch, initialValues = {} }: EventSearchProps) {
  // State for search parameters
  const [search, setSearch] = useState(initialValues.search || "");
  const [category, setCategory] = useState(initialValues.category || "");
  const [dateFilter, setDateFilter] = useState(initialValues.dateFilter || "");
  const [priceFilter, setPriceFilter] = useState(initialValues.priceFilter || "");
  const [location, setLocation] = useState(initialValues.location || "");
  const [sortBy, setSortBy] = useState(initialValues.sortBy || "date-desc");
  const [eventType, setEventType] = useState(initialValues.eventType || "");
  const [featured, setFeatured] = useState(initialValues.featured || false);
  
  // Custom date range state
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [minDate, setMinDate] = useState<Date | undefined>(
    initialValues.minDate ? new Date(initialValues.minDate) : undefined
  );
  const [maxDate, setMaxDate] = useState<Date | undefined>(
    initialValues.maxDate ? new Date(initialValues.maxDate) : undefined
  );
  
  // Advanced filters visibility
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Active filters count
  const getActiveFiltersCount = () => {
    let count = 0;
    if (category) count++;
    if (dateFilter) count++;
    if (priceFilter) count++;
    if (location) count++;
    if (eventType) count++;
    if (featured) count++;
    if (minDate || maxDate) count++;
    return count;
  };
  
  // Clear all filters
  const clearAllFilters = () => {
    setSearch("");
    setCategory("");
    setDateFilter("");
    setPriceFilter("");
    setLocation("");
    setEventType("");
    setFeatured(false);
    setMinDate(undefined);
    setMaxDate(undefined);
    
    // Trigger search with cleared parameters
    onSearch({
      search: "",
      category: "",
      dateFilter: "",
      priceFilter: "",
      location: "",
      sortBy,
      eventType: "",
      featured: false
    });
  };
  
  // Clear specific filter
  const clearFilter = (filterName: string) => {
    switch (filterName) {
      case 'search':
        setSearch("");
        break;
      case 'category':
        setCategory("");
        break;
      case 'dateFilter':
        setDateFilter("");
        break;
      case 'priceFilter':
        setPriceFilter("");
        break;
      case 'location':
        setLocation("");
        break;
      case 'eventType':
        setEventType("");
        break;
      case 'featured':
        setFeatured(false);
        break;
      case 'dateRange':
        setMinDate(undefined);
        setMaxDate(undefined);
        break;
    }
  };
  
  // Debounced search
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      onSearch({
        search: value,
        category,
        dateFilter,
        priceFilter,
        minDate: minDate ? format(minDate, 'yyyy-MM-dd') : undefined,
        maxDate: maxDate ? format(maxDate, 'yyyy-MM-dd') : undefined,
        location,
        sortBy,
        eventType,
        featured
      });
    }, 500),
    [category, dateFilter, priceFilter, minDate, maxDate, location, sortBy, eventType, featured]
  );
  
  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    debouncedSearch(value);
  };
  
  // Handle filter changes
  const handleFilterChange = useCallback(
    throttle(() => {
      onSearch({
        search,
        category,
        dateFilter,
        priceFilter,
        minDate: minDate ? format(minDate, 'yyyy-MM-dd') : undefined,
        maxDate: maxDate ? format(maxDate, 'yyyy-MM-dd') : undefined,
        location,
        sortBy,
        eventType,
        featured
      });
    }, 300),
    [search, category, dateFilter, priceFilter, minDate, maxDate, location, sortBy, eventType, featured]
  );
  
  // Effect to trigger search when filters change
  useEffect(() => {
    handleFilterChange();
  }, [category, dateFilter, priceFilter, location, sortBy, eventType, featured, handleFilterChange]);
  
  // Effect to close date picker when both dates are selected
  useEffect(() => {
    if (minDate && maxDate) {
      setIsDatePickerOpen(false);
      setDateFilter("custom");
      handleFilterChange();
    }
  }, [minDate, maxDate, handleFilterChange]);
  
  // Handle date filter change
  const handleDateFilterChange = (value: string) => {
    // Clear custom date range if selecting a predefined filter
    if (value !== "custom") {
      setMinDate(undefined);
      setMaxDate(undefined);
    }
    setDateFilter(value);
  };
  
  // Render active filters
  const renderActiveFilters = () => {
    const filters = [];
    
    if (category) {
      filters.push(
        <Badge 
          key="category" 
          variant="outline" 
          className="flex items-center gap-1 bg-gray-100"
          onClick={() => clearFilter('category')}
        >
          <TagIcon className="h-3 w-3" />
          Category: {category}
          <XIcon className="h-3 w-3 ml-1 cursor-pointer" />
        </Badge>
      );
    }
    
    if (dateFilter) {
      let dateLabel = dateFilter;
      if (dateFilter === "custom" && (minDate || maxDate)) {
        dateLabel = `${minDate ? format(minDate, 'MMM d, yyyy') : 'Any start'} - ${maxDate ? format(maxDate, 'MMM d, yyyy') : 'Any end'}`;
      } else {
        dateLabel = EVENT_DATE_FILTERS.find(df => df.value === dateFilter)?.label || dateFilter;
      }
      
      filters.push(
        <Badge 
          key="date" 
          variant="outline" 
          className="flex items-center gap-1 bg-gray-100"
          onClick={() => clearFilter(dateFilter === "custom" ? 'dateRange' : 'dateFilter')}
        >
          <CalendarIcon className="h-3 w-3" />
          Date: {dateLabel}
          <XIcon className="h-3 w-3 ml-1 cursor-pointer" />
        </Badge>
      );
    }
    
    if (priceFilter) {
      filters.push(
        <Badge 
          key="price" 
          variant="outline" 
          className="flex items-center gap-1 bg-gray-100"
          onClick={() => clearFilter('priceFilter')}
        >
          Price: {EVENT_PRICE_FILTERS.find(pf => pf.value === priceFilter)?.label || priceFilter}
          <XIcon className="h-3 w-3 ml-1 cursor-pointer" />
        </Badge>
      );
    }
    
    if (location) {
      filters.push(
        <Badge 
          key="location" 
          variant="outline" 
          className="flex items-center gap-1 bg-gray-100"
          onClick={() => clearFilter('location')}
        >
          <MapPinIcon className="h-3 w-3" />
          Location: {location}
          <XIcon className="h-3 w-3 ml-1 cursor-pointer" />
        </Badge>
      );
    }
    
    if (eventType) {
      filters.push(
        <Badge 
          key="eventType" 
          variant="outline" 
          className="flex items-center gap-1 bg-gray-100"
          onClick={() => clearFilter('eventType')}
        >
          Type: {EVENT_TYPES.find(et => et.value === eventType)?.label || eventType}
          <XIcon className="h-3 w-3 ml-1 cursor-pointer" />
        </Badge>
      );
    }
    
    if (featured) {
      filters.push(
        <Badge 
          key="featured" 
          variant="outline" 
          className="flex items-center gap-1 bg-gray-100"
          onClick={() => clearFilter('featured')}
        >
          Featured Only
          <XIcon className="h-3 w-3 ml-1 cursor-pointer" />
        </Badge>
      );
    }
    
    return filters;
  };
  
  // Render sort icon based on current sort
  const renderSortIcon = () => {
    switch(sortBy) {
      case 'date-asc':
        return <ArrowDownAZ className="h-4 w-4" />;
      case 'date-desc':
        return <ArrowUpAZ className="h-4 w-4" />;
      case 'price-low':
        return <ArrowDown01 className="h-4 w-4" />;
      case 'price-high':
        return <ArrowUp01 className="h-4 w-4" />;
      default:
        return <ArrowUpAZ className="h-4 w-4" />;
    }
  };
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
      {/* Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search events, venues, or keywords..."
            className="pl-10"
            value={search}
            onChange={handleSearchChange}
          />
          {search && (
            <button 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => {
                setSearch("");
                debouncedSearch("");
              }}
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <SlidersIcon className="h-4 w-4" />
            Filters
            {getActiveFiltersCount() > 0 && (
              <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full">
                {getActiveFiltersCount()}
              </Badge>
            )}
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                {renderSortIcon()}
                Sort
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2">
              <div className="flex flex-col gap-1">
                <Button 
                  variant={sortBy === 'date-desc' ? 'default' : 'ghost'} 
                  size="sm" 
                  className="justify-start"
                  onClick={() => setSortBy('date-desc')}
                >
                  <ArrowUpAZ className="h-4 w-4 mr-2" />
                  Newest First
                </Button>
                <Button 
                  variant={sortBy === 'date-asc' ? 'default' : 'ghost'} 
                  size="sm" 
                  className="justify-start"
                  onClick={() => setSortBy('date-asc')}
                >
                  <ArrowDownAZ className="h-4 w-4 mr-2" />
                  Oldest First
                </Button>
                <Button 
                  variant={sortBy === 'price-low' ? 'default' : 'ghost'} 
                  size="sm" 
                  className="justify-start"
                  onClick={() => setSortBy('price-low')}
                >
                  <ArrowDown01 className="h-4 w-4 mr-2" />
                  Price: Low to High
                </Button>
                <Button 
                  variant={sortBy === 'price-high' ? 'default' : 'ghost'} 
                  size="sm" 
                  className="justify-start"
                  onClick={() => setSortBy('price-high')}
                >
                  <ArrowUp01 className="h-4 w-4 mr-2" />
                  Price: High to Low
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {EVENT_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <div className="relative">
              <Select value={dateFilter} onValueChange={handleDateFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Any Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any Date</SelectItem>
                  {EVENT_DATE_FILTERS.map(filter => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              
              {dateFilter === "custom" && (
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full mt-2 justify-start text-left font-normal"
                      onClick={() => setIsDatePickerOpen(true)}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {minDate && maxDate ? (
                        `${format(minDate, 'MMM d, yyyy')} - ${format(maxDate, 'MMM d, yyyy')}`
                      ) : minDate ? (
                        `From ${format(minDate, 'MMM d, yyyy')}`
                      ) : maxDate ? (
                        `Until ${format(maxDate, 'MMM d, yyyy')}`
                      ) : (
                        "Select date range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{
                        from: minDate || undefined,
                        to: maxDate || undefined
                      }}
                      onSelect={range => {
                        setMinDate(range?.from);
                        setMaxDate(range?.to);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price
            </label>
            <Select value={priceFilter} onValueChange={setPriceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Any Price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any Price</SelectItem>
                {EVENT_PRICE_FILTERS.map(filter => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <div className="relative">
              <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="City or venue name"
                className="pl-10"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Type
            </label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                {EVENT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center mt-7">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={featured}
                onChange={e => setFeatured(e.target.checked)}
              />
              <span className="text-sm font-medium text-gray-700">Featured Events Only</span>
            </label>
          </div>
          
          <div className="flex items-center justify-end mt-7 col-span-1 md:col-span-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
              disabled={getActiveFiltersCount() === 0}
            >
              Clear All Filters
            </Button>
          </div>
        </div>
      )}
      
      {/* Active Filters */}
      {getActiveFiltersCount() > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {renderActiveFilters()}
        </div>
      )}
    </div>
  );
}