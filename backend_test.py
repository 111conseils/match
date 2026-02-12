#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for RecruitHub Application
Tests all authentication, CRUD operations for candidates, positions, matching, and stats
"""

import requests
import sys
from datetime import datetime
import json

class RecruitHubAPITester:
    def __init__(self, base_url="https://recruit-hub-95.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data IDs for cleanup
        self.created_candidat_id = None
        self.created_poste_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, require_auth=True):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if require_auth and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            
            result = {
                'test': name,
                'method': method,
                'endpoint': endpoint,
                'expected_status': expected_status,
                'actual_status': response.status_code,
                'success': success,
                'response': None,
                'error': None
            }

            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    result['response'] = response.json() if response.text else {}
                except:
                    result['response'] = response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json() if response.text else {'detail': 'No response body'}
                    result['error'] = error_detail
                    print(f"   Error: {error_detail}")
                except:
                    result['error'] = response.text or 'Unknown error'
                    print(f"   Error: {response.text}")

            self.test_results.append(result)
            return success, result.get('response', {})

        except Exception as e:
            print(f"❌ Failed - Network/Connection Error: {str(e)}")
            result = {
                'test': name,
                'method': method,
                'endpoint': endpoint,
                'expected_status': expected_status,
                'actual_status': 'ERROR',
                'success': False,
                'response': None,
                'error': str(e)
            }
            self.test_results.append(result)
            return False, {}

    def test_authentication(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION")
        print("="*50)
        
        # Test login with provided credentials
        success, response = self.run_test(
            "Login with existing credentials",
            "POST",
            "auth/login",
            200,
            data={"email": "test@recruithub.fr", "password": "test123"},
            require_auth=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   ✅ Token acquired: {self.token[:20]}...")
        else:
            print("   ❌ Failed to get authentication token")
            return False
        
        # Test get current user info
        self.run_test(
            "Get current user info",
            "GET",
            "auth/me",
            200,
            require_auth=True
        )
        
        # Test registration of new user
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@example.com"
        self.run_test(
            "Register new user",
            "POST",
            "auth/register",
            200,
            data={"email": test_email, "password": "testpass123"},
            require_auth=False
        )
        
        return True

    def test_candidats_crud(self):
        """Test candidates CRUD operations with new features"""
        print("\n" + "="*50)
        print("TESTING CANDIDATS CRUD WITH NEW FEATURES")
        print("="*50)
        
        # List candidats (should work even if empty)
        self.run_test(
            "List all candidats",
            "GET",
            "candidats",
            200
        )
        
        # Create a new candidat with source and status
        candidat_data = {
            "nom": "Dupont",
            "prenom": "Marie",
            "ville": "Bordeaux",
            "rayon_km": 30,
            "titre_poste": "Développeur Web",
            "remuneration": "35-40K€",
            "disponibilite": "Immédiate",
            "statut": "NOUVEAU",
            "source": "LinkedIn"
        }
        
        success, response = self.run_test(
            "Create new candidat with source and status",
            "POST",
            "candidats",
            200,
            data=candidat_data
        )
        
        if success and 'id' in response:
            self.created_candidat_id = response['id']
            print(f"   ✅ Created candidat ID: {self.created_candidat_id}")
            
            # Get the created candidat
            self.run_test(
                "Get candidat by ID",
                "GET",
                f"candidats/{self.created_candidat_id}",
                200
            )
            
            # Update the candidat status to PCLT with honoraire
            update_data = {
                "statut": "PCLT",
                "honoraire": 8000.0,
                "source": "Indeed"
            }
            
            self.run_test(
                "Update candidat status to PCLT with honoraire",
                "PUT",
                f"candidats/{self.created_candidat_id}",
                200,
                data=update_data
            )
            
            # Test different status updates
            for status in ["ENCV", "ENTC", "PROPALE", "REFUS", "NOGO_DISPO"]:
                self.run_test(
                    f"Update candidat status to {status}",
                    "PUT",
                    f"candidats/{self.created_candidat_id}",
                    200,
                    data={"statut": status}
                )
        
        return True

    def test_postes_crud(self):
        """Test positions CRUD operations"""
        print("\n" + "="*50)
        print("TESTING POSTES CRUD")
        print("="*50)
        
        # List postes
        self.run_test(
            "List all postes",
            "GET",
            "postes",
            200
        )
        
        # Create a new poste
        poste_data = {
            "entreprise": "TechCorp",
            "titre_poste": "Développeur Web",
            "ville": "Bordeaux"
        }
        
        success, response = self.run_test(
            "Create new poste",
            "POST",
            "postes",
            200,
            data=poste_data
        )
        
        if success and 'id' in response:
            self.created_poste_id = response['id']
            print(f"   ✅ Created poste ID: {self.created_poste_id}")
            
            # Get the created poste
            self.run_test(
                "Get poste by ID",
                "GET",
                f"postes/{self.created_poste_id}",
                200
            )
            
            # Update the poste
            update_data = {
                "ville": "Lyon"
            }
            
            self.run_test(
                "Update poste",
                "PUT",
                f"postes/{self.created_poste_id}",
                200,
                data=update_data
            )
        
        return True

    def test_matching(self):
        """Test matching endpoints"""
        print("\n" + "="*50)
        print("TESTING MATCHING")
        print("="*50)
        
        # Test get all matches
        self.run_test(
            "Get all matches",
            "GET",
            "matching",
            200
        )
        
        # Test matches for specific poste (if we have one)
        if self.created_poste_id:
            self.run_test(
                "Get matches for specific poste",
                "GET",
                f"matching/{self.created_poste_id}",
                200
            )
        else:
            print("   ⚠️  Skipping specific poste matching (no poste created)")

    def test_stats(self):
        """Test stats endpoint"""
        print("\n" + "="*50)
        print("TESTING STATS")
        print("="*50)
        
        self.run_test(
            "Get dashboard stats",
            "GET",
            "stats",
            200
        )

    def test_error_handling(self):
        """Test error handling for invalid requests"""
        print("\n" + "="*50)
        print("TESTING ERROR HANDLING")
        print("="*50)
        
        # Test accessing candidat with invalid ID
        self.run_test(
            "Get candidat with invalid ID",
            "GET",
            "candidats/invalid-id",
            404
        )
        
        # Test creating candidat with invalid data
        self.run_test(
            "Create candidat with missing required fields",
            "POST",
            "candidats",
            422,
            data={"nom": "Test"}  # Missing required fields
        )
        
        # Test unauthorized access (without token)
        temp_token = self.token
        self.token = None
        self.run_test(
            "Access without authentication",
            "GET",
            "candidats",
            403,
            require_auth=True
        )
        self.token = temp_token

    def cleanup(self):
        """Clean up test data"""
        print("\n" + "="*50)
        print("CLEANUP")
        print("="*50)
        
        if self.created_candidat_id:
            self.run_test(
                "Delete created candidat",
                "DELETE",
                f"candidats/{self.created_candidat_id}",
                200
            )
        
        if self.created_poste_id:
            self.run_test(
                "Delete created poste",
                "DELETE",
                f"postes/{self.created_poste_id}",
                200
            )

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        
        passed_tests = [r for r in self.test_results if r['success']]
        failed_tests = [r for r in self.test_results if not r['success']]
        
        print(f"📊 Total tests: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {len(failed_tests)}")
        print(f"📈 Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   • {test['test']}: Expected {test['expected_status']}, got {test['actual_status']}")
                if test.get('error'):
                    print(f"     Error: {test['error']}")
        
        print("\n" + "="*70)
        return self.tests_passed == self.tests_run

def main():
    """Run all tests"""
    print("🚀 Starting RecruitHub Backend API Tests")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = RecruitHubAPITester()
    
    try:
        # Run authentication tests first
        if not tester.test_authentication():
            print("❌ Authentication failed, stopping tests")
            return 1
        
        # Run all test suites
        tester.test_candidats_crud()
        tester.test_postes_crud()
        tester.test_matching()
        tester.test_stats()
        tester.test_error_handling()
        
        # Cleanup
        tester.cleanup()
        
        # Print summary
        success = tester.print_summary()
        
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())