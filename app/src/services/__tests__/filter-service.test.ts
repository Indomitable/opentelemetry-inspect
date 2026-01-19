import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';
import {FilterService} from '../filter-service';
import {StorageServiceMock} from "../__mocks__/stroage-service.mock.ts";

describe('FilterService', () => {
    let filterService: FilterService;
    let storageServiceMock: StorageServiceMock;

    beforeEach(() => {
        storageServiceMock = new StorageServiceMock();
        vi.spyOn(storageServiceMock, 'write');
        vi.spyOn(storageServiceMock, 'remove');
        vi.spyOn(storageServiceMock, 'read');
        filterService = new FilterService('test', storageServiceMock);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('addFilter', () => {
        it('should add a single filter', () => {
            filterService.addFilter('name', 'John');
            expect(filterService.hasFilter('name')).toBe(true);
        });

        it('should store filter in storage', () => {
            filterService.addFilter('name', 'John');
            expect(storageServiceMock.write).toHaveBeenCalledWith('test-filter-name', 'John');
        });

        it('should add multiple filters', () => {
            filterService.addFilter('name', 'John');
            filterService.addFilter('age', '30');
            expect(filterService.hasFilter('name')).toBe(true);
            expect(filterService.hasFilter('age')).toBe(true);
        });

        it('should overwrite existing filter with same key', () => {
            filterService.addFilter('name', 'John');
            filterService.addFilter('name', 'Jane');
            expect(filterService.activeFilters[0].value).toBe('Jane');
        });
    });

    describe('removeFilter', () => {
        it('should remove an existing filter', () => {
            filterService.addFilter('name', 'John');
            filterService.removeFilter('name');
            expect(filterService.hasFilter('name')).toBe(false);
        });

        it('should remove filter from storage', () => {
            filterService.addFilter('name', 'John');
            filterService.removeFilter('name');
            expect(storageServiceMock.remove).toHaveBeenCalledWith('test-filter-name');
        });

        it('should remove resource filter', () => {
            filterService.addFilter('resource.key', 'service1');
            filterService.removeFilter('resource.key');
            expect(filterService.hasFilter('resource.key')).toBe(false);
        });

        it('should not throw when removing non-existent filter', () => {
            expect(() => filterService.removeFilter('nonexistent')).not.toThrow();
        });
    });

    describe('hasFilter', () => {
        it('should return true when filter exists', () => {
            filterService.addFilter('name', 'John');
            expect(filterService.hasFilter('name')).toBe(true);
        });

        it('should return false when filter does not exist', () => {
            expect(filterService.hasFilter('name')).toBe(false);
        });

        it('should return false after filter is removed', () => {
            filterService.addFilter('name', 'John');
            filterService.removeFilter('name');
            expect(filterService.hasFilter('name')).toBe(false);
        });
    });

    describe('clearAllFilters', () => {
        it('should remove all active filters', () => {
            filterService.addFilter('name', 'John');
            filterService.addFilter('age', '30');
            filterService.addFilter('city', 'New York');

            filterService.clearAllFilters();

            expect(filterService.hasFilter('name')).toBe(false);
            expect(filterService.hasFilter('age')).toBe(false);
            expect(filterService.hasFilter('city')).toBe(false);
        });

        it('should work when no filters are active', () => {
            expect(() => filterService.clearAllFilters()).not.toThrow();
            expect(filterService.activeFilters.length).toBe(0);
        });

        it('should remove filters from storage', () => {
            filterService.addFilter('name', 'John');
            filterService.addFilter('age', '30');

            filterService.clearAllFilters();

            expect(storageServiceMock.remove).toHaveBeenCalledWith('test-filter-name');
            expect(storageServiceMock.remove).toHaveBeenCalledWith('test-filter-age');
        });

        it('should reset selected resource when clearing all filters', () => {
            filterService.filterByResource({key: 'service1', name: 'My Service'} as any);
            expect(filterService.selectedResourceKey).toBe('service1');

            filterService.clearAllFilters();

            expect(filterService.selectedResourceKey).toBeNull();
        });
    });

    describe('filterByResource', () => {
        it('should add resource filter when resource is provided', () => {
            const resource = {key: 'service1', name: 'My Service'};
            filterService.filterByResource(resource as any);

            expect(filterService.hasFilter('resource.key')).toBe(true);
            expect(filterService.selectedResourceKey).toBe('service1');
        });

        it('should remove resource filter when resource is null', () => {
            filterService.filterByResource({key: 'service1', name: 'My Service'} as any);
            expect(filterService.hasFilter('resource.key')).toBe(true);

            filterService.filterByResource(null);

            expect(filterService.hasFilter('resource.key')).toBe(false);
            expect(filterService.selectedResourceKey).toBeNull();
        });

        it('should update resource filter when different resource is selected', () => {
            filterService.filterByResource({key: 'service1', name: 'Service 1'} as any);
            expect(filterService.selectedResourceKey).toBe('service1');

            filterService.filterByResource({key: 'service2', name: 'Service 2'} as any);

            expect(filterService.selectedResourceKey).toBe('service2');
            expect(filterService.activeFilters[0].value).toBe('service2');
        });
    });

    describe('activeFilters getter', () => {
        it('should return empty array when no filters are active', () => {
            expect(filterService.activeFilters).toEqual([]);
        });

        it('should return all active filters with correct format', () => {
            filterService.addFilter('name', 'John');
            filterService.addFilter('age', '30');

            const filters = filterService.activeFilters;

            expect(filters.length).toBe(2);
            expect(filters.some(f => f.key === 'name' && f.value === 'John')).toBe(true);
            expect(filters.some(f => f.key === 'age' && f.value === '30')).toBe(true);
        });

        it('should display resource filter with display name "resource"', () => {
            filterService.addFilter('resource.key', 'service1');

            const filters = filterService.activeFilters;

            expect(filters[0].display).toBe('resource');
            expect(filters[0].key).toBe('resource.key');
        });

        it('should use key name for display for non-resource filters', () => {
            filterService.addFilter('environment', 'production');

            const filters = filterService.activeFilters;

            expect(filters[0].display).toBe('environment');
        });
    });

    describe('selectedResourceKey getter', () => {
        it('should return null when no resource filter is active', () => {
            expect(filterService.selectedResourceKey).toBeNull();
        });

        it('should return resource key when resource filter is active', () => {
            filterService.filterByResource({key: 'service1', name: 'My Service'} as any);
            expect(filterService.selectedResourceKey).toBe('service1');
        });

        it('should return null after resource filter is removed', () => {
            filterService.filterByResource({key: 'service1', name: 'My Service'} as any);
            filterService.removeFilter('resource.key');
            expect(filterService.selectedResourceKey).toBeNull();
        });
    });

    describe('matchesFilter', () => {
        it('should return true when no filters are active', () => {
            const obj = {name: 'John', age: 30};
            expect(filterService.matchesFilter(obj)).toBe(true);
        });

        it('should return true when all filters match', () => {
            filterService.addFilter('name', 'John');
            filterService.addFilter('age', '30');

            const obj = {name: 'John', age: '30'};
            expect(filterService.matchesFilter(obj)).toBe(true);
        });

        it('should return false when one filter does not match', () => {
            filterService.addFilter('name', 'John');
            filterService.addFilter('age', '30');

            const obj = {name: 'John', age: '25'};
            expect(filterService.matchesFilter(obj)).toBe(false);
        });

        it('should return false when a single filter does not match', () => {
            filterService.addFilter('name', 'John');

            const obj = {name: 'Jane'};
            expect(filterService.matchesFilter(obj)).toBe(false);
        });

        it('should ignore filters with keys not part of the object', () => {
            filterService.addFilter('name', 'John');
            filterService.addFilter('notExists', 'value');

            const obj = {name: 'John'};
            expect(filterService.matchesFilter(obj)).toBe(true);
        });

        it('should support nested object properties using dot notation', () => {
            filterService.addFilter('user.name', 'John');

            const obj = {user: {name: 'John', age: 30}};
            expect(filterService.matchesFilter(obj)).toBe(true);
        });

        it('should return false when nested property does not match', () => {
            filterService.addFilter('user.name', 'Jane');

            const obj = {user: {name: 'John', age: 30}};
            expect(filterService.matchesFilter(obj)).toBe(false);
        });

        it('should handle missing nested properties', () => {
            filterService.addFilter('user.profile.name', 'John');

            const obj = {user: {age: 30}};
            expect(filterService.matchesFilter(obj)).toBe(true);
        });

        it('should match resource filter with nested resource.key', () => {
            filterService.addFilter('resource.key', 'service1');

            const obj = {resource: {key: 'service1', name: 'My Service'}};
            expect(filterService.matchesFilter(obj)).toBe(true);
        });

        it('should return false when resource.key does not match', () => {
            filterService.addFilter('resource.key', 'service1');

            const obj = {resource: {key: 'service2', name: 'My Service'}};
            expect(filterService.matchesFilter(obj)).toBe(false);
        });
    });
});
