from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from webdriver_manager.chrome import ChromeDriverManager

import time
import random
import os
from datetime import datetime, timedelta
from models import get_ist_time, is_within_ist_window


def type_message_with_newlines(driver, message_box, message):
    """
    Types a message that may contain paragraphs and links.
    Uses direct send_keys with SHIFT+ENTER for newlines.
    This works on headless Linux servers where pyperclip (clipboard) is not available.
    """
    # Split message by newline and send each part
    lines = message.split('\n')
    for i, line in enumerate(lines):
        message_box.send_keys(line)
        if i < len(lines) - 1:
            # Add a newline without sending the message
            message_box.send_keys(Keys.SHIFT, Keys.ENTER)
    
    # Trigger link recognition by sending a space and backspace
    # This 'wakes up' the WhatsApp input handler to linkify URLs
    try:
        time.sleep(0.5)
        message_box.send_keys(Keys.SPACE)
        time.sleep(0.2)
        message_box.send_keys(Keys.BACKSPACE)
    except Exception as link_err:
        print(f"⚠️ Warning: Failed to trigger link recognition (ignored): {link_err}")
    
    # Wait for link preview/processing
    time.sleep(1.0)


def wait_for_message_to_send(driver, wait, timeout=10):
    """
    Waits until the message is sent by checking if the 'Send' button disappears 
    and turns back into the microphone icon, or just waits a few seconds.
    """
    try:
        # After pressing ENTER, just wait 2.5 seconds. 
        # Checking for empty text box is unreliable in Lexical editors and caused 30s delays.
        time.sleep(2.5)
        return True
    except Exception:
        return False


def send_messages(contacts, template, username="default", on_status=None, logs_collection=None, broadcast_func=None, users_collection=None):
    """
    Sends messages with specific restrictions:
    - Only between 10 AM and 6 PM IST.
    - Max 100 people per batch.
    - 1 hour cooldown between batches.
    - Max 800 people per day.
    """
    results = {
        "status": "completed",
        "sent_count": 0,
        "failed_count": 0,
        "total_attempted": 0
    }
    
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-setuid-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--single-process")
    options.add_argument("--no-zygote")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-infobars")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-popup-blocking")
    options.add_argument("--disable-default-apps")
    options.add_argument("--disable-background-networking")
    options.add_argument("--disable-sync")
    options.add_argument("--disable-translate")
    options.add_argument("--metrics-recording-only")
    options.add_argument("--safebrowsing-disable-auto-update")
    options.add_argument("--no-first-run")
    options.add_argument("--mute-audio")
    options.add_argument("--hide-scrollbars")
    # REMOVE remote-debugging-port as it causes conflicts between users
    # options.add_argument("--remote-debugging-port=9222")
    options.add_argument("--proxy-bypass-list=*")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-software-rasterizer")
    options.add_argument("--disable-dev-config")
    
    # NOTE: We do NOT disable images/canvas here.
    # WhatsApp QR codes are rendered on a <canvas> element, and disabling
    # image/canvas rendering via blink-settings prevents the QR from appearing.
    
    # Headless mode for cloud deployment (Render/Linux)
    # FORCING TRUE by default for Render stability
    is_headless = os.getenv("HEADLESS", "true").lower() == "true"
    
    if is_headless:
        print("🌐 Running in HEADLESS mode (Forced for stability)")
        options.add_argument("--headless=new")
        # Smaller window size = Much less RAM usage
        options.add_argument("--window-size=800,600")
        options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    # Explicitly set Chrome binary path for Linux environments
    for path in ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]:
        if os.path.exists(path):
            options.binary_location = path
            break

    # Use /tmp for profile in production to avoid permission/crash issues on Render
    # Append username to make it unique per user
    if os.getenv("HEADLESS", "false").lower() == "true":
        profile_path = f"/tmp/chrome_profile_{username}"
    else:
        profile_path = os.path.abspath(f"chrome_profile_{username}")
    
    if not os.path.exists(profile_path):
        os.makedirs(profile_path, exist_ok=True)
        
    options.add_argument(f"user-data-dir={profile_path}")

    driver = None
    
    try:
        total_contacts = len(contacts)
        
        for i in range(0, total_contacts, 100):
            # 1. CHECK DAILY LIMIT (800)
            if logs_collection is not None:
                today = get_ist_time().replace(hour=0, minute=0, second=0, microsecond=0)
                sent_today = logs_collection.count_documents({
                    "status": "Sent",
                    "created_at": {"$gte": today}
                })
                
                if sent_today >= 800:
                    print("🚫 Daily limit of 800 reached. Stopping for today.")
                    if broadcast_func:
                        broadcast_func({"type": "DAILY_LIMIT_REACHED", "data": {"sent": sent_today}})
                    results["status"] = "daily_limit_reached"
                    break
            
            # 2. CHECK TIME WINDOW (10 AM - 6 PM)
            is_waiting_for_window = False
            while not is_within_ist_window(10, 18):
                if not is_waiting_for_window:
                    print("⏳ Outside sending window (10 AM - 6 PM). Waiting...")
                    if broadcast_func:
                        broadcast_func({"type": "WAITING_FOR_WINDOW", "data": {"start_hour": 10}})
                    is_waiting_for_window = True
                time.sleep(60) 
            
            if is_waiting_for_window:
                if broadcast_func:
                    broadcast_func({"type": "WINDOW_RESUMED", "data": {}})
                is_waiting_for_window = False

            # Get current batch
            batch = contacts[i:i+100]
            print(f"📦 Processing batch of {len(batch)} contacts ({i+1} to {min(i+100, total_contacts)})")

            # Initialize driver if not already open
            if not driver:
                print(f"[{username}] 🌐 Running in HEADLESS mode (Forced for stability)")
                # System-wide chromedriver path (standard for Linux/Docker)
                driver_path = "/usr/bin/chromedriver"
                
                if os.path.exists(driver_path):
                    print(f"[{username}] 🚀 Using system chromedriver at {driver_path}")
                    service = Service(executable_path=driver_path)
                else:
                    # Fallback for local development
                    print(f"[{username}] 🏠 Using webdriver_manager for local development")
                    service = Service(ChromeDriverManager().install())

                driver = webdriver.Chrome(
                    service=service,
                    options=options
                )
                print(f"[{username}] ✅ Browser started successfully.")
                wait = WebDriverWait(driver, 300)
                send_wait = WebDriverWait(driver, 30)

                driver.get("https://web.whatsapp.com")
                print(f"[{username}] Waiting for WhatsApp login...")

                # Immediately notify frontend that we are waiting for QR
                if broadcast_func:
                    broadcast_func({"type": "QR_LOADING", "data": {}})
                    print(f"[{username}] 📡 Sent QR_LOADING signal to frontend")

                # Wait a few seconds for WhatsApp Web to fully render the QR page
                time.sleep(5)

                # QR Code relay for headless mode
                # QR selectors — from most specific to least specific
                qr_selectors = [
                    "div[data-testid='qrcode'] canvas",
                    "canvas[aria-label]",
                    "div._akau canvas",
                    "div[data-ref] canvas",
                    "canvas",
                ]

                login_check_iterations = 0
                while login_check_iterations < 60:  # 5 minutes max (5s * 60)
                    try:
                        # Check if logged in
                        if driver.find_elements(By.ID, "pane-side"):
                            print(f"[{username}] ✅ WhatsApp Logged In Successfully")
                            
                            # Wait for 15 seconds to allow WhatsApp to sync messages properly
                            # This prevents the first message from failing due to incomplete loading
                            print(f"[{username}] ⏳ Waiting 15s for WhatsApp to sync data...")
                            time.sleep(15)
                            
                            # Retrieve the linked WhatsApp number
                            try:
                                last_wid = driver.execute_script("return window.localStorage.getItem('last-wid')")
                                if last_wid:
                                    wa_number = last_wid.strip('"').split('@')[0]
                                    print(f"[{username}] 🔗 Linked WhatsApp Number: {wa_number}")
                                    
                                    if users_collection is not None:
                                        # Check if this number is linked to a different user
                                        existing_user = users_collection.find_one({"linked_wa_number": wa_number})
                                        if existing_user and existing_user["username"] != username:
                                            print(f"[{username}] ❌ This WhatsApp number is already linked to another account ({existing_user['username']})")
                                            if broadcast_func:
                                                broadcast_func({"type": "ERROR", "data": {"message": "This WhatsApp number is already linked to another account. Please use a different number."}})
                                            results["status"] = "number_already_linked"
                                            if driver: driver.quit()
                                            return results
                                        else:
                                            # Save the number to the current user
                                            users_collection.update_one(
                                                {"username": username},
                                                {"$set": {"linked_wa_number": wa_number}}
                                            )
                            except Exception as e:
                                print(f"[{username}] ⚠️ Could not fetch linked WhatsApp number: {e}")
                                
                            break
                        
                        # Look for QR code canvas using multiple selectors
                        qr_found = False
                        for selector in qr_selectors:
                            try:
                                qr_elements = driver.find_elements(By.CSS_SELECTOR, selector)
                                if qr_elements:
                                    # Verify the canvas has actual content (non-zero dimensions)
                                    el = qr_elements[0]
                                    width = driver.execute_script("return arguments[0].width", el)
                                    height = driver.execute_script("return arguments[0].height", el)
                                    if width and height and width > 10 and height > 10:
                                        qr_base64 = el.screenshot_as_base64
                                        if broadcast_func:
                                            broadcast_func({
                                                "type": "QR_CODE",
                                                "data": {"image": f"data:image/png;base64,{qr_base64}"}
                                            })
                                        print(f"[{username}] 📲 QR Code captured via '{selector}' and sent to frontend ({width}x{height}px)")
                                        qr_found = True
                                        break
                            except Exception as sel_err:
                                print(f"[{username}] Selector '{selector}' failed: {sel_err}")
                                continue

                        if not qr_found:
                            print(f"[{username}] ⏳ QR canvas not ready yet (attempt {login_check_iterations + 1})")
                        
                    except Exception as e:
                        print(f"[{username}] Error during login check: {e}")
                    
                    time.sleep(5)
                    login_check_iterations += 1
                
                # Final check after loop
                if not driver.find_elements(By.ID, "pane-side"):
                    print(f"[{username}] ❌ Login timeout or failed")
                    if driver: driver.quit()
                    results["status"] = "login_failed"
                    return results

            # SEND BATCH
            contact_index = 0
            for contact in batch:
                contact_index += 1
                contact_start_time = time.time()
                results["total_attempted"] += 1
                
                name = contact["name"]
                number = str(contact["number"]).strip()
                print(f"[{username}] 🔄 Processing contact {i + contact_index} of {total_contacts}: {name} ({number})")
                
                if broadcast_func:
                    broadcast_func({
                        "type": "PROGRESS_UPDATE",
                        "data": {
                            "current": i + contact_index,
                            "total": total_contacts,
                            "name": name,
                            "sent": results["sent_count"],
                            "failed": results["failed_count"]
                        }
                    })

                # Double check time window inside the batch
                if not is_within_ist_window(10, 18):
                    print("⏳ Window closed during batch. Pausing.")
                    results["status"] = "window_closed"
                    break

                try:
                    name = contact["name"]
                    number = str(contact["number"]).strip()
                    
                    # Ensure number is in international format (just digits for URL navigation)
                    if len(number) == 10 and number.isdigit():
                        number = "91" + number
                    elif number.startswith("+"):
                        number = number[1:]
                        
                    message = template.replace("{name}", name)

                    # Dismiss any unexpected alerts (like "Leave site?") before navigating
                    try:
                        alert = driver.switch_to.alert
                        print(f"[{username}] ⚠️ Dismissing alert: {alert.text}")
                        alert.dismiss()
                    except:
                        pass

                    print(f"[{username}] 🚀 Navigating to chat for {name} ({number})...")
                    url = f"https://web.whatsapp.com/send?phone={number}"
                    
                    # Disable onbeforeunload to prevent "Leave site?" alerts from blocking driver.get
                    try:
                        driver.execute_script("window.onbeforeunload = null;")
                    except:
                        pass
                        
                    try:
                        driver.get(url)
                    except Exception as e:
                        print(f"[{username}] ⚠️ Navigation exception for {name}: {e}")
                        try:
                            # Try to dismiss any unexpected alert (like "Leave site?")
                            alert = driver.switch_to.alert
                            print(f"[{username}] ⚠️ Dismissing unexpected alert: {alert.text}")
                            alert.accept() # Accept to proceed leaving the site
                            # Retry navigation
                            driver.get(url)
                        except Exception as alert_err:
                            print(f"[{username}] ⚠️ Error handling alert during navigation retry: {alert_err}")
                            # Try one final time to navigate directly
                            try:
                                driver.get(url)
                            except Exception as retry_err:
                                raise Exception(f"Failed to navigate to WhatsApp chat: {retry_err}")

                    # Wait for the message box with a shorter timeout (30s)
                    message_box = None
                    start_time = time.time()
                    
                    box_selectors = [
                        '//footer//div[@contenteditable="true"]',
                        '//div[@id="main"]//footer//div[@contenteditable="true"]',
                        '//div[@title="Type a message"]',
                        '//div[@data-testid="conversation-text-input"]'
                    ]

                    while time.time() - start_time < 60: # Increased to 60s for slow cloud environments
                        try:
                            # 1. Try to find the message box
                            for xpath in box_selectors:
                                elements = driver.find_elements(By.XPATH, xpath)
                                if elements and elements[0].is_displayed():
                                    message_box = elements[0]
                                    break
                            if message_box:
                                break
                            
                            # 2. Check for invalid number modals
                            page_text = driver.page_source.lower()
                            invalid_triggers = [
                                "phone number shared via url is invalid",
                                "url is invalid",
                                "is not on whatsapp",
                                "invalid number"
                            ]
                            
                            if any(trigger in page_text for trigger in invalid_triggers):
                                print(f"[{username}] ⚠️ Phone number {number} appears to be invalid on WhatsApp.")
                                break

                            time.sleep(1.5)
                        except Exception as e:
                            # If an unexpected alert (e.g. "Leave site?") pops up during chat loading, handle it dynamically
                            if "alert" in str(e).lower() or "unexpected alert" in str(e).lower():
                                try:
                                    alert = driver.switch_to.alert
                                    print(f"[{username}] ⚠️ Handling unexpected alert during chat load: {alert.text}")
                                    alert.accept() # Accept to proceed leaving or dismissing
                                except:
                                    pass
                            time.sleep(1.5)

                    if not message_box:
                        print(f"[{username}] ❌ Message box not found.")
                        raise Exception("Message box not found (Possible invalid number or slow connection)")

                    time.sleep(2.5) # Extra safety for cloud environment
                    
                    # Ensure focus using JavaScript before typing
                    try:
                        driver.execute_script("arguments[0].focus();", message_box)
                    except:
                        pass
                        
                    message_box.click()
                    time.sleep(0.5)
                    type_message_with_newlines(driver, message_box, message)
                    time.sleep(1.0)
                    # Use ActionChains to send the ENTER key. This is a best practice for Lexical/React editors
                    # because it does not hold a reference to the DOM element, avoiding StaleElementReferenceExceptions
                    # when the message box re-renders instantly upon sending.
                    try:
                        webdriver.ActionChains(driver).send_keys(Keys.ENTER).perform()
                    except Exception as enter_err:
                        print(f"[{username}] ⚠️ ActionChains ENTER failed, falling back to direct send_keys: {enter_err}")
                        try:
                            message_box.send_keys(Keys.ENTER)
                        except Exception as fallback_err:
                            if "stale" in str(fallback_err).lower():
                                print(f"[{username}] ⚠️ Ignored stale element exception during fallback ENTER.")
                            else:
                                raise fallback_err
                    
                    # Confirm send
                    wait_for_message_to_send(driver, send_wait)
                    
                    print(f"[{username}] ✅ Message sent to {name}")
                    results["sent_count"] += 1
                    if on_status:
                        on_status(contact, "Sent")
                    
                    # ANTI-BAN DELAY ENFORCEMENT
                    # The user explicitly wants a gap to prevent bans. 
                    # A random gap between 15 and 65 seconds is the safest way to avoid detection.
                    delay = random.randint(15, 65)
                    print(f"[{username}] ⏳ Anti-Ban Delay: Waiting {delay}s before the next message...")
                    time.sleep(delay)

                except Exception as e:
                    print(f"[{username}] ❌ Failed for {name}: {e}")
                    results["failed_count"] += 1
                    if on_status:
                        on_status(contact, "Failed")
                    
                    # Even if it fails, wait a bit to avoid hammering
                    time.sleep(5)

            # AFTER BATCH
            print(f"[{username}] ✅ Batch completed.")
            
            # Check if there are more contacts
            if i + 100 < total_contacts and results["status"] == "completed":
                # Notify cooldown for the next batch
                if broadcast_func:
                    broadcast_func({"type": "COOLDOWN_START", "data": {"seconds": 3600}})
                
                print(f"[{username}] 💤 Batch finished. Closing browser for 1-hour cooldown...")
                if driver:
                    driver.quit()
                    driver = None
                time.sleep(3600) # 1 hour wait
            elif results["status"] != "completed":
                break
        
        # Trigger cooldown even after the final batch is processed
        if results["sent_count"] > 0:
            if broadcast_func:
                broadcast_func({"type": "COOLDOWN_START", "data": {"seconds": 3600}})
            print("💤 Process finished. Final 1-hour cooldown started.")

        return results

    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass
        if broadcast_func:
            broadcast_func({"type": "PROCESS_FINISHED", "data": {}})
        print("✅ All scheduled messages processed")