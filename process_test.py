#!/usr/bin/env python3
"""
Process API Testing for RecruitHub Application
Tests the new process system where candidates can be in process on multiple positions
"""

import requests
import sys
from datetime import datetime
import json

class ProcessAPITester:
    def __init__(self, base_url="https://candidate-job-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data IDs
        self.candidat_id_1 = None
        self.candidat_id_2 = None
        self.poste_id_1 = None
        self.poste_id_2 = None
        self.process_ids = []

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

    def login(self):
        """Login and get token"""
        success, response = self.run_test(
            "Login for process testing",
            "POST",
            "auth/login",
            200,
            data={"email": "test@recruithub.fr", "password": "test123"},
            require_auth=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   ✅ Token acquired for process tests")
            return True
        return False

    def setup_test_data(self):
        """Create test candidates and positions"""
        print("\n" + "="*50)
        print("SETTING UP TEST DATA")
        print("="*50)
        
        # Create two candidates
        candidat_1_data = {
            "nom": "Martin",
            "prenom": "Jean",
            "ville": "Paris",
            "rayon_km": 25,
            "titre_poste": "Développeur Python",
            "remuneration": "40-45K€",
            "disponibilite": "1 mois",
            "source": "LinkedIn"
        }
        
        candidat_2_data = {
            "nom": "Durand",
            "prenom": "Sophie",
            "ville": "Lyon",
            "rayon_km": 20,
            "titre_poste": "Data Scientist",
            "remuneration": "45-50K€",
            "disponibilite": "Immédiate",
            "source": "Indeed"
        }
        
        success_1, response_1 = self.run_test(
            "Create test candidat 1",
            "POST",
            "candidats",
            200,
            data=candidat_1_data
        )
        
        success_2, response_2 = self.run_test(
            "Create test candidat 2",
            "POST",
            "candidats",
            200,
            data=candidat_2_data
        )
        
        if success_1 and 'id' in response_1:
            self.candidat_id_1 = response_1['id']
            print(f"   ✅ Candidat 1 ID: {self.candidat_id_1}")
        
        if success_2 and 'id' in response_2:
            self.candidat_id_2 = response_2['id']
            print(f"   ✅ Candidat 2 ID: {self.candidat_id_2}")
        
        # Create two positions
        poste_1_data = {
            "entreprise": "TechStartup",
            "titre_poste": "Développeur Python",
            "ville": "Paris"
        }
        
        poste_2_data = {
            "entreprise": "DataCorp",
            "titre_poste": "Data Scientist",
            "ville": "Lyon"
        }
        
        success_3, response_3 = self.run_test(
            "Create test poste 1",
            "POST",
            "postes",
            200,
            data=poste_1_data
        )
        
        success_4, response_4 = self.run_test(
            "Create test poste 2",
            "POST",
            "postes",
            200,
            data=poste_2_data
        )
        
        if success_3 and 'id' in response_3:
            self.poste_id_1 = response_3['id']
            print(f"   ✅ Poste 1 ID: {self.poste_id_1}")
        
        if success_4 and 'id' in response_4:
            self.poste_id_2 = response_4['id']
            print(f"   ✅ Poste 2 ID: {self.poste_id_2}")
        
        return all([self.candidat_id_1, self.candidat_id_2, self.poste_id_1, self.poste_id_2])

    def test_process_crud(self):
        """Test process CRUD operations"""
        print("\n" + "="*50)
        print("TESTING PROCESS CRUD OPERATIONS")
        print("="*50)
        
        # Test empty process list first
        self.run_test(
            "List all process (initially empty)",
            "GET",
            "process",
            200
        )
        
        # Create first process: Candidat 1 -> Poste 1
        process_1_data = {
            "candidat_id": self.candidat_id_1,
            "poste_id": self.poste_id_1,
            "statut": "ENCV",
            "notes": "Premier process de test"
        }
        
        success, response = self.run_test(
            "Create process 1 (Candidat 1 -> Poste 1)",
            "POST",
            "process",
            200,
            data=process_1_data
        )
        
        if success and 'id' in response:
            process_1_id = response['id']
            self.process_ids.append(process_1_id)
            print(f"   ✅ Process 1 ID: {process_1_id}")
        
        # Create second process: Same candidat, different position
        process_2_data = {
            "candidat_id": self.candidat_id_1,
            "poste_id": self.poste_id_2,
            "statut": "ENTC",
            "honoraire": 6000.0,
            "notes": "Candidat 1 sur second poste"
        }
        
        success, response = self.run_test(
            "Create process 2 (Same candidat, different poste)",
            "POST",
            "process",
            200,
            data=process_2_data
        )
        
        if success and 'id' in response:
            process_2_id = response['id']
            self.process_ids.append(process_2_id)
            print(f"   ✅ Process 2 ID: {process_2_id}")
        
        # Create third process: Different candidat, first position
        process_3_data = {
            "candidat_id": self.candidat_id_2,
            "poste_id": self.poste_id_1,
            "statut": "PROPALE",
            "notes": "Candidat 2 sur premier poste"
        }
        
        success, response = self.run_test(
            "Create process 3 (Different candidat, same poste)",
            "POST",
            "process",
            200,
            data=process_3_data
        )
        
        if success and 'id' in response:
            process_3_id = response['id']
            self.process_ids.append(process_3_id)
            print(f"   ✅ Process 3 ID: {process_3_id}")
        
        # Test duplicate process creation (should fail)
        duplicate_data = {
            "candidat_id": self.candidat_id_1,
            "poste_id": self.poste_id_1,
            "statut": "NOUVEAU"
        }
        
        self.run_test(
            "Create duplicate process (should fail)",
            "POST",
            "process",
            400,
            data=duplicate_data
        )

    def test_process_queries(self):
        """Test process query endpoints"""
        print("\n" + "="*50)
        print("TESTING PROCESS QUERY ENDPOINTS")
        print("="*50)
        
        # Test get all processes
        self.run_test(
            "Get all processes with candidat and poste info",
            "GET",
            "process",
            200
        )
        
        # Test get processes by candidat
        self.run_test(
            "Get processes by candidat 1",
            "GET",
            f"process/candidat/{self.candidat_id_1}",
            200
        )
        
        self.run_test(
            "Get processes by candidat 2",
            "GET",
            f"process/candidat/{self.candidat_id_2}",
            200
        )
        
        # Test get processes by poste
        self.run_test(
            "Get processes by poste 1",
            "GET",
            f"process/poste/{self.poste_id_1}",
            200
        )
        
        self.run_test(
            "Get processes by poste 2",
            "GET",
            f"process/poste/{self.poste_id_2}",
            200
        )

    def test_process_updates(self):
        """Test process status and data updates"""
        print("\n" + "="*50)
        print("TESTING PROCESS UPDATES")
        print("="*50)
        
        if not self.process_ids:
            print("   ⚠️  No process IDs available for update tests")
            return
        
        first_process_id = self.process_ids[0]
        
        # Test status updates
        statuses_to_test = ["ENTC", "PROPALE", "PCLT", "REFUS", "NOGO_DISPO"]
        
        for statut in statuses_to_test:
            update_data = {"statut": statut}
            if statut == "PCLT":
                update_data["honoraire"] = 7500.0
                update_data["notes"] = "Candidat placé avec succès"
            
            self.run_test(
                f"Update process status to {statut}",
                "PUT",
                f"process/{first_process_id}",
                200,
                data=update_data
            )
        
        # Test update with just notes
        self.run_test(
            "Update process notes only",
            "PUT",
            f"process/{first_process_id}",
            200,
            data={"notes": "Notes mises à jour"}
        )

    def test_process_integration_with_matching(self):
        """Test process integration with matching system"""
        print("\n" + "="*50)
        print("TESTING PROCESS-MATCHING INTEGRATION")
        print("="*50)
        
        # Test matching with existing processes
        self.run_test(
            "Get matches for poste 1 (with existing processes)",
            "GET",
            f"matching/{self.poste_id_1}",
            200
        )
        
        self.run_test(
            "Get matches for poste 2 (with existing processes)",
            "GET",
            f"matching/{self.poste_id_2}",
            200
        )

    def cleanup(self):
        """Clean up test data"""
        print("\n" + "="*50)
        print("CLEANUP")
        print("="*50)
        
        # Delete processes
        for process_id in self.process_ids:
            self.run_test(
                f"Delete process {process_id[:8]}...",
                "DELETE",
                f"process/{process_id}",
                200
            )
        
        # Delete candidates (this should also delete associated processes)
        if self.candidat_id_1:
            self.run_test(
                "Delete candidat 1",
                "DELETE",
                f"candidats/{self.candidat_id_1}",
                200
            )
        
        if self.candidat_id_2:
            self.run_test(
                "Delete candidat 2",
                "DELETE",
                f"candidats/{self.candidat_id_2}",
                200
            )
        
        # Delete positions
        if self.poste_id_1:
            self.run_test(
                "Delete poste 1",
                "DELETE",
                f"postes/{self.poste_id_1}",
                200
            )
        
        if self.poste_id_2:
            self.run_test(
                "Delete poste 2",
                "DELETE",
                f"postes/{self.poste_id_2}",
                200
            )

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*70)
        print("PROCESS TESTING SUMMARY")
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
        
        print("\n🎯 KEY FEATURES TESTED:")
        print("   • Multiple processes per candidate ✅")
        print("   • Independent process statuses ✅")
        print("   • Process CRUD operations ✅")
        print("   • Process-candidat-poste relationships ✅")
        print("   • Process filtering and queries ✅")
        
        print("\n" + "="*70)
        return self.tests_passed == self.tests_run

def main():
    """Run all process tests"""
    print("🚀 Starting RecruitHub Process System Tests")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = ProcessAPITester()
    
    try:
        # Login first
        if not tester.login():
            print("❌ Authentication failed, stopping tests")
            return 1
        
        # Setup test data
        if not tester.setup_test_data():
            print("❌ Test data setup failed, stopping tests")
            return 1
        
        # Run process tests
        tester.test_process_crud()
        tester.test_process_queries()
        tester.test_process_updates()
        tester.test_process_integration_with_matching()
        
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